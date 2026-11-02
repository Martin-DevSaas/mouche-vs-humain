// Leaky integrate-and-fire network, a step-for-step port of Shiu et al. 2024
// (Nature 634:210, github.com/philshiu/Drosophila_brain_model, model.py @ 91bdd1e).
//
//   dv/dt = (v_0 - v + g) / t_mbr   (unless refractory)
//   dg/dt = -g / tau                (unless refractory)
//   spike when v > v_th; reset v = v_rst, g = 0; refractory t_rfc
//   synapse: g += w after a 1.8 ms delay, w = synapse count * sign * w_syn
//   Poisson input: v += w_syn * f_poi, Poisson targets have no refractory period
//
// Each time step reproduces Brian2's default schedule, in Brian2's order:
//   groups (exact linear integration, frozen while refractory)
//   -> thresholds -> synapses (delayed events into g, Poisson events into v)
//   -> resets.
// "(unless refractory)" also makes v and g conditional-write in Brian2: events
// reaching a refractory neuron (or one spiking this step) are dropped, not stored.
// State is Float64, like Brian2. Spikes at step s are delivered at step s + delay.

import { Rng } from "./rng";

export interface LifParams {
  vRest: number; // mV
  vReset: number; // mV
  vThreshold: number; // mV
  tauMembrane: number; // ms
  tauSynapse: number; // ms
  refractory: number; // ms
  delay: number; // ms
  wSyn: number; // mV per synapse
  poissonWeightFactor: number;
  dt: number; // ms
}

/** model.py default_params (Brian2's default dt of 0.1 ms). */
export const SHIU_PARAMS: LifParams = {
  vRest: -52,
  vReset: -52,
  vThreshold: -45,
  tauMembrane: 20,
  tauSynapse: 5,
  refractory: 2.2,
  delay: 1.8,
  wSyn: 0.275,
  poissonWeightFactor: 250,
  dt: 0.1,
};

/** Default Poisson input rate of model.py (r_poi), in Hz. */
export const SHIU_POISSON_RATE_HZ = 150;

export interface Network {
  n: number;
  /** CSR row pointers, length n + 1, rows = presynaptic neuron. */
  offsets: Uint32Array;
  targets: Uint16Array | Uint32Array;
  /** Signed synapse counts. */
  weights: Int16Array | Int32Array;
}

const NEVER = -0x40000000;

export class LifSimulator {
  readonly n: number;
  readonly params: LifParams;
  readonly v: Float64Array;
  readonly g: Float64Array;
  /** Step of the last spike of each neuron. */
  readonly lastSpike: Int32Array;
  readonly spikeCount: Uint32Array;
  /** Neurons whose outgoing synapses are muted (Shiu's "silence": w = 0). */
  readonly silenced: Uint8Array;
  step = 0;

  private readonly net: Network;
  private readonly refractorySteps: Int32Array;
  private readonly delaySteps: number;
  private readonly slots: number;
  private readonly ring: Float64Array;
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;
  private readonly wPoisson: number;
  private readonly defaultRefractory: number;

  // Poisson inputs.
  private rng: Rng;
  private poissonTargets = new Int32Array(0);
  private poissonP = new Float64Array(0);
  private poissonLogQ = new Float64Array(0);
  private poissonNext = new Float64Array(0);
  // Scheduled (deterministic) input events, sorted by step.
  private eventSteps = new Int32Array(0);
  private eventTargets = new Int32Array(0);
  private eventCursor = 0;

  private spikesThisStep: Int32Array;

  constructor(net: Network, params: LifParams = SHIU_PARAMS, seed = 1) {
    this.net = net;
    this.n = net.n;
    this.params = params;
    const n = net.n;
    this.v = new Float64Array(n).fill(params.vRest);
    this.g = new Float64Array(n);
    this.lastSpike = new Int32Array(n).fill(NEVER);
    this.spikeCount = new Uint32Array(n);
    this.silenced = new Uint8Array(n);
    this.defaultRefractory = Math.round(params.refractory / params.dt);
    this.refractorySteps = new Int32Array(n).fill(this.defaultRefractory);
    this.delaySteps = Math.round(params.delay / params.dt);
    if (this.delaySteps < 1) throw new Error("delay must be at least one time step");
    this.slots = this.delaySteps + 1;
    this.ring = new Float64Array(this.slots * n);
    const { dt, tauMembrane: tm, tauSynapse: ts } = params;
    this.a = Math.exp(-dt / tm);
    this.b = Math.exp(-dt / ts);
    // Exact solution of the linear system over one step.
    this.c = (ts / (ts - tm)) * (this.b - this.a);
    this.wPoisson = params.wSyn * params.poissonWeightFactor;
    this.rng = new Rng(seed);
    this.spikesThisStep = new Int32Array(n);
  }

  get timeMs(): number {
    return this.step * this.params.dt;
  }

  /**
   * Poisson inputs, as Brian2's PoissonInput(N=1): each target receives an event
   * with probability rate * dt per step. Targets lose their refractory period.
   * Event times are drawn as geometric gaps, which is the same distribution and
   * stays exact when rates change (memoryless).
   */
  setPoissonInputs(targets: ArrayLike<number>, ratesHz: ArrayLike<number>): void {
    const k = targets.length;
    if (ratesHz.length !== k) throw new Error("targets and rates differ in length");
    for (let i = 0; i < this.poissonTargets.length; i++) {
      this.refractorySteps[this.poissonTargets[i]] = this.defaultRefractory;
    }
    this.poissonTargets = Int32Array.from(targets);
    this.poissonP = new Float64Array(k);
    this.poissonLogQ = new Float64Array(k);
    this.poissonNext = new Float64Array(k);
    for (let i = 0; i < k; i++) this.refractorySteps[this.poissonTargets[i]] = 0;
    this.setPoissonRates(ratesHz);
  }

  /** Change rates without changing targets; next events are redrawn from now. */
  setPoissonRates(ratesHz: ArrayLike<number>): void {
    const dtS = this.params.dt / 1000;
    for (let i = 0; i < this.poissonTargets.length; i++) {
      const p = Math.min(1, Math.max(0, ratesHz[i] * dtS));
      this.poissonP[i] = p;
      this.poissonLogQ[i] = p < 1 ? Math.log1p(-p) : -Infinity;
      this.poissonNext[i] = this.drawNext(i, this.step);
    }
  }

  /**
   * Deterministic input events (same effect as a Poisson event: v += w_syn * f_poi),
   * used to compare against Brian2 with identical inputs. Targets lose their
   * refractory period, like Poisson targets in model.py.
   */
  setScheduledInputs(steps: Int32Array, targets: Int32Array): void {
    const order = Array.from(steps.keys()).sort((i, j) => steps[i] - steps[j] || targets[i] - targets[j]);
    this.eventSteps = Int32Array.from(order, (i) => steps[i]);
    this.eventTargets = Int32Array.from(order, (i) => targets[i]);
    this.eventCursor = 0;
    for (let i = 0; i < targets.length; i++) this.refractorySteps[targets[i]] = 0;
    while (this.eventCursor < this.eventSteps.length && this.eventSteps[this.eventCursor] < this.step) {
      this.eventCursor++;
    }
  }

  private drawNext(i: number, from: number): number {
    const p = this.poissonP[i];
    if (p <= 0) return Infinity;
    if (p >= 1) return from;
    return from + Math.floor(Math.log(this.rng.nextOpen()) / this.poissonLogQ[i]);
  }

  /**
   * Advance one time step. Calls onSpike(neuron, step) for every spike, in
   * increasing neuron order.
   */
  advance(onSpike?: (neuron: number, step: number) => void): number {
    const n = this.n;
    const s = this.step;
    const { v, g, lastSpike, refractorySteps, ring, spikesThisStep } = this;
    const vRest = this.params.vRest;
    const vReset = this.params.vReset;
    const vTh = this.params.vThreshold;
    const a = this.a;
    const b = this.b;
    const c = this.c;
    const base = (s % this.slots) * n;
    let nSpikes = 0;

    for (let i = 0; i < n; i++) {
      // groups: integrate unless refractory
      const notRefractory = s - lastSpike[i] >= refractorySteps[i];
      if (notRefractory) {
        const gi = g[i];
        v[i] = vRest + (v[i] - vRest) * a + gi * c;
        g[i] = gi * b;
      }
      // thresholds
      const spiked = notRefractory && v[i] > vTh;
      // synapses: events due now. "(unless refractory)" makes v and g
      // conditional-write variables in Brian2 (neurongroup.py, set_conditional_write):
      // writes are dropped while the neuron is refractory, including on its spike step.
      const r = ring[base + i];
      if (r !== 0) {
        if (notRefractory && !spiked) g[i] += r;
        ring[base + i] = 0;
      }
      // resets
      if (spiked) {
        v[i] = vReset;
        g[i] = 0;
        lastSpike[i] = s;
        spikesThisStep[nSpikes++] = i;
      }
    }

    // synapses: Poisson / scheduled events into v, under the same conditional
    // write (dropped if the target spiked this step or is refractory).
    const w = this.wPoisson;
    const pt = this.poissonTargets;
    const pn = this.poissonNext;
    for (let k = 0; k < pt.length; k++) {
      while (pn[k] <= s) {
        const i = pt[k];
        if (lastSpike[i] !== s && s - lastSpike[i] >= refractorySteps[i]) v[i] += w;
        pn[k] = this.drawNext(k, s + 1);
      }
    }
    while (this.eventCursor < this.eventSteps.length && this.eventSteps[this.eventCursor] === s) {
      const i = this.eventTargets[this.eventCursor++];
      if (lastSpike[i] !== s && s - lastSpike[i] >= refractorySteps[i]) v[i] += w;
    }

    // Spikes of this step are delivered delaySteps later.
    const { offsets, targets, weights } = this.net;
    const wSyn = this.params.wSyn;
    const dBase = ((s + this.delaySteps) % this.slots) * n;
    for (let k = 0; k < nSpikes; k++) {
      const i = spikesThisStep[k];
      this.spikeCount[i]++;
      onSpike?.(i, s);
      if (this.silenced[i]) continue;
      for (let e = offsets[i], end = offsets[i + 1]; e < end; e++) {
        ring[dBase + targets[e]] += weights[e] * wSyn;
      }
    }
    this.step = s + 1;
    return nSpikes;
  }

  /** Run `steps` time steps; returns the number of spikes. */
  run(steps: number, onSpike?: (neuron: number, step: number) => void): number {
    let total = 0;
    for (let k = 0; k < steps; k++) total += this.advance(onSpike);
    return total;
  }
}
