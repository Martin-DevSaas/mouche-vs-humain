// Simulation session: what the Web Worker runs. Kept free of DOM/worker APIs so
// the exact same code runs in Vitest and in the headless benchmark.

import { LifSimulator, SHIU_PARAMS, type Network } from "./lif";

export interface SpikeChunk {
  /** First step covered by this chunk (inclusive) and step after the last. */
  fromStep: number;
  toStep: number;
  /** Spikes in time order: step and neuron index, same length. */
  steps: Int32Array;
  neurons: Int32Array;
}

export class SimSession {
  private sim: LifSimulator;
  private seed: number;

  constructor(private readonly net: Network, seed: number) {
    this.seed = seed;
    this.sim = new LifSimulator(net, SHIU_PARAMS, seed);
  }

  get step(): number {
    return this.sim.step;
  }

  get currentSeed(): number {
    return this.seed;
  }

  /** Fresh network at rest; `silenced` mutes the outgoing synapses of those neurons. */
  reset(seed: number, silenced: ArrayLike<number> = []): void {
    this.seed = seed;
    this.sim = new LifSimulator(this.net, SHIU_PARAMS, seed);
    for (let k = 0; k < silenced.length; k++) this.sim.silenced[silenced[k]] = 1;
  }

  setInputs(targets: ArrayLike<number>, ratesHz: ArrayLike<number>): void {
    this.sim.setPoissonInputs(targets, ratesHz);
  }

  setRates(ratesHz: ArrayLike<number>): void {
    this.sim.setPoissonRates(ratesHz);
  }

  /** Run `steps` time steps and return every spike they produced. */
  run(steps: number): SpikeChunk {
    const fromStep = this.sim.step;
    let s = new Int32Array(4096);
    let nr = new Int32Array(4096);
    let k = 0;
    this.sim.run(steps, (neuron, step) => {
      if (k === s.length) {
        const s2 = new Int32Array(k * 2);
        const n2 = new Int32Array(k * 2);
        s2.set(s);
        n2.set(nr);
        s = s2;
        nr = n2;
      }
      s[k] = step;
      nr[k] = neuron;
      k++;
    });
    return { fromStep, toStep: this.sim.step, steps: s.slice(0, k), neurons: nr.slice(0, k) };
  }
}
