import { describe, expect, it } from "vitest";
import { LifSimulator, SHIU_PARAMS, type Network } from "./lif";

const P = SHIU_PARAMS;
const DELAY = 18; // 1.8 ms / 0.1 ms
const REFRACTORY = 22; // 2.2 ms / 0.1 ms
const W_POISSON = P.wSyn * P.poissonWeightFactor; // 68.75 mV

/** Build a CSR network from (pre, post, synapses) triples. */
function net(n: number, edges: [number, number, number][]): Network {
  const sorted = [...edges].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const offsets = new Uint32Array(n + 1);
  for (const [pre] of sorted) offsets[pre + 1]++;
  for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
  return {
    n,
    offsets,
    targets: Uint32Array.from(sorted, (e) => e[1]),
    weights: Int32Array.from(sorted, (e) => e[2]),
  };
}

/** Analytic free response of the model (no spike, not refractory). */
function analyticV(t: number, v0: number, g0: number): number {
  const { vRest, tauMembrane: tm, tauSynapse: ts } = P;
  return vRest + (v0 - vRest) * Math.exp(-t / tm) + g0 * (ts / (ts - tm)) * (Math.exp(-t / ts) - Math.exp(-t / tm));
}

function spikesOf(sim: LifSimulator, steps: number): [number, number][] {
  const out: [number, number][] = [];
  sim.run(steps, (i, s) => out.push([i, s]));
  return out;
}

describe("single neuron vs analytic solution", () => {
  it("relaxes from a depolarised state exactly like the closed form", () => {
    const sim = new LifSimulator(net(1, []));
    sim.v[0] = -47;
    for (let k = 1; k <= 2000; k++) {
      sim.advance();
      expect(sim.v[0]).toBeCloseTo(analyticV(k * P.dt, -47, 0), 10);
    }
  });

  it("follows the synaptic (difference of exponentials) response", () => {
    const sim = new LifSimulator(net(1, []));
    sim.g[0] = 20; // mV, below threshold-crossing amplitude
    let peak = -Infinity;
    for (let k = 1; k <= 1000; k++) {
      sim.advance();
      expect(sim.v[0]).toBeCloseTo(analyticV(k * P.dt, P.vRest, 20), 10);
      expect(sim.g[0]).toBeCloseTo(20 * Math.exp((-k * P.dt) / P.tauSynapse), 12);
      peak = Math.max(peak, sim.v[0]);
    }
    // Peak time t* = ln(tm/ts) * tm*ts/(tm-ts) = 9.24 ms, amplitude 0.1575 * g0.
    const tStar = (Math.log(P.tauMembrane / P.tauSynapse) * P.tauMembrane * P.tauSynapse) /
      (P.tauMembrane - P.tauSynapse);
    expect(peak).toBeCloseTo(analyticV(tStar, P.vRest, 20), 4);
  });

  it("spikes at the first step where the analytic trajectory exceeds threshold", () => {
    const g0 = 60;
    let expected = -1;
    for (let k = 1; k < 1000 && expected < 0; k++) {
      if (analyticV(k * P.dt, P.vRest, g0) > P.vThreshold) expected = k;
    }
    const sim = new LifSimulator(net(1, []));
    sim.g[0] = g0;
    sim.step = 1; // the state above is the state at the start of step 1
    const spikes = spikesOf(sim, 1000);
    expect(spikes[0]).toEqual([0, expected]);
  });
});

describe("Brian2 schedule details", () => {
  it("a Poisson/scheduled event makes its target spike on the next step", () => {
    const sim = new LifSimulator(net(1, []));
    sim.setScheduledInputs(Int32Array.from([5]), Int32Array.from([0]));
    expect(spikesOf(sim, 50)).toEqual([[0, 6]]);
  });

  it("an event arriving on the step the target spikes is erased by the reset", () => {
    const sim = new LifSimulator(net(1, []));
    // 5 -> spike at 6; event at 6 lost (reset after synapses); 7 -> spike at 8.
    sim.setScheduledInputs(Int32Array.from([5, 6, 7]), Int32Array.from([0, 0, 0]));
    expect(spikesOf(sim, 50)).toEqual([[0, 6], [0, 8]]);
  });

  it("delivers a spike to g exactly delay steps later", () => {
    const sim = new LifSimulator(net(2, [[0, 1, 10]]));
    sim.setScheduledInputs(Int32Array.from([0]), Int32Array.from([0]));
    sim.run(1 + DELAY); // neuron 0 spikes at step 1, delivery at step 1 + 18
    expect(sim.g[1]).toBe(0);
    sim.advance();
    expect(sim.g[1]).toBeCloseTo(10 * P.wSyn, 12);
  });

  it("freezes v and g while refractory and drops events that arrive meanwhile (Brian2 conditional write)", () => {
    // 0 drives 2 strongly (spike of 2 at step 19 + a few); 1 sends a large event
    // that arrives while 2 is refractory: it must be dropped, not stored in g.
    const syn = 400;
    const tCross = (() => {
      for (let k = 1; ; k++) if (analyticV(k * P.dt, P.vRest, syn * P.wSyn) > P.vThreshold) return k;
    })();
    const spike2 = 1 + DELAY + tCross;
    const arrival = spike2 + 5; // inside [spike2 + 1, spike2 + 21]
    const sim = new LifSimulator(net(3, [[0, 2, syn], [1, 2, syn]]));
    sim.setScheduledInputs(Int32Array.from([0, arrival - DELAY - 1]), Int32Array.from([0, 1]));
    const spikes: [number, number][] = [];
    for (let k = 0; k < 400; k++) {
      sim.advance((i, s) => spikes.push([i, s]));
      const s = sim.step - 1;
      if (s > spike2 && s < spike2 + REFRACTORY) {
        expect(sim.v[2]).toBe(P.vReset);
        expect(sim.g[2]).toBe(0);
      }
    }
    expect(spikes).toEqual([[0, 1], [1, arrival - DELAY], [2, spike2]]);
    expect(sim.g[2]).toBe(0);
  });

  it("counts an event arriving on the first non-refractory step", () => {
    const syn = 400;
    const tCross = (() => {
      for (let k = 1; ; k++) if (analyticV(k * P.dt, P.vRest, syn * P.wSyn) > P.vThreshold) return k;
    })();
    const spike2 = 1 + DELAY + tCross;
    const arrival = spike2 + REFRACTORY; // refractory ends at this step
    const sim = new LifSimulator(net(3, [[0, 2, syn], [1, 2, syn]]));
    sim.setScheduledInputs(Int32Array.from([0, arrival - DELAY - 1]), Int32Array.from([0, 1]));
    const spikes: [number, number][] = [];
    sim.run(400, (i, s) => spikes.push([i, s]));
    expect(spikes).toEqual([[0, 1], [2, spike2], [1, arrival - DELAY], [2, arrival + tCross]]);
  });

  it("matches a hand-computed three-neuron network (excitation, then cancelled by inhibition)", () => {
    const syn = 200; // 55 mV into g: crosses threshold
    const tCross = (() => {
      for (let k = 1; ; k++) if (analyticV(k * P.dt, P.vRest, syn * P.wSyn) > P.vThreshold) return k;
    })();
    // Excitation alone: 0 spikes at 1, g of 2 jumps at 1 + 18 = 19 (synapses slot),
    // integration starts at step 20, so 2 spikes at 19 + tCross.
    const exc = new LifSimulator(net(3, [[0, 2, syn], [1, 2, -syn]]));
    exc.setScheduledInputs(Int32Array.from([0]), Int32Array.from([0]));
    expect(spikesOf(exc, 200)).toEqual([[0, 1], [2, 1 + DELAY + tCross]]);
    // Simultaneous equal inhibition: g of 2 stays exactly 0, no spike.
    const both = new LifSimulator(net(3, [[0, 2, syn], [1, 2, -syn]]));
    both.setScheduledInputs(Int32Array.from([0, 0]), Int32Array.from([0, 1]));
    expect(spikesOf(both, 200)).toEqual([[0, 1], [1, 1]]);
    expect(both.v[2]).toBe(P.vRest);
  });

  it("silencing a neuron mutes its outgoing synapses only", () => {
    const sim = new LifSimulator(net(2, [[0, 1, 400]]));
    sim.silenced[0] = 1;
    sim.setScheduledInputs(Int32Array.from([0]), Int32Array.from([0]));
    expect(spikesOf(sim, 200)).toEqual([[0, 1]]);
  });
});

describe("Poisson input", () => {
  it("is reproducible from the seed", () => {
    const run = (seed: number) => {
      const sim = new LifSimulator(net(4, [[0, 3, 50], [1, 3, 50]]), P, seed);
      sim.setPoissonInputs([0, 1, 2], [150, 150, 300]);
      return spikesOf(sim, 5000);
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it("drives its target at rate * (1 - p): one spike per event, minus events lost to resets", () => {
    const sim = new LifSimulator(net(1, []), P, 7);
    sim.setPoissonInputs([0], [150]);
    const seconds = 200;
    sim.run((seconds * 1000) / P.dt);
    const p = 150 * P.dt * 1e-3;
    const expected = 150 * (1 - p); // an event on the spike step itself is erased
    const sd = Math.sqrt(expected * seconds) / seconds;
    expect(Math.abs(sim.spikeCount[0] / seconds - expected)).toBeLessThan(4 * sd);
  });

  it("changing the rate mid-run takes effect immediately", () => {
    const sim = new LifSimulator(net(1, []), P, 3);
    sim.setPoissonInputs([0], [0]);
    sim.run(10000);
    expect(sim.spikeCount[0]).toBe(0);
    sim.setPoissonRates([1e5]); // p >= 1: an event every step
    sim.run(10);
    expect(sim.spikeCount[0]).toBe(5); // spike, lost event, spike, ...
    expect(W_POISSON).toBeCloseTo(68.75, 12);
  });
});
