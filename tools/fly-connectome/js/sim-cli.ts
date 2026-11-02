// Headless runner of the front-end LIF engine (src/features/fly-connect4/sim/lif.ts),
// used by 06_validate_reference.py to compare against Brian2.
//
//   npx tsx tools/fly-connectome/js/sim-cli.ts <job.json>
//
// job.json:
//   network_dir   directory with meta.json + network.bin (format of public/fly-brain/v1)
//   duration_ms, trials, seed
//   poisson       optional { targets: number[], rate_hz: number } or { targets, rates_hz: number[] }
//   scheduled     optional path to an int32 file of (step, target) pairs
//   silence       optional number[] of neuron indices
//   out           output prefix: <out>.counts.u32 (trials x n), <out>.spikes.i32 (trial, step, neuron)*

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LifSimulator, SHIU_PARAMS } from "../../../src/features/fly-connect4/sim/lif";
import { parseNetwork, type BrainMeta } from "../../../src/features/fly-connect4/sim/network";

interface Job {
  network_dir: string;
  duration_ms: number;
  trials: number;
  seed: number;
  poisson?: { targets: number[]; rate_hz?: number; rates_hz?: number[] };
  scheduled?: string;
  silence?: number[];
  out: string;
  record_spikes?: boolean;
}

function readBuf(path: string): ArrayBuffer {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

const job = JSON.parse(readFileSync(process.argv[2], "utf8")) as Job;
const meta = JSON.parse(readFileSync(join(job.network_dir, "meta.json"), "utf8")) as BrainMeta;
const net = parseNetwork(meta, readBuf(join(job.network_dir, "network.bin")));
const steps = Math.round(job.duration_ms / SHIU_PARAMS.dt);
const counts = new Uint32Array(job.trials * net.n);
const spikes: number[] = [];

let sched: Int32Array | null = null;
if (job.scheduled) sched = new Int32Array(readBuf(job.scheduled));

const t0 = performance.now();
for (let trial = 0; trial < job.trials; trial++) {
  const sim = new LifSimulator(net, SHIU_PARAMS, job.seed + trial);
  for (const i of job.silence ?? []) sim.silenced[i] = 1;
  if (job.poisson) {
    const p = job.poisson;
    sim.setPoissonInputs(p.targets, p.rates_hz ?? p.targets.map(() => p.rate_hz ?? 0));
  }
  if (sched) {
    const k = sched.length / 2;
    sim.setScheduledInputs(
      Int32Array.from({ length: k }, (_, j) => sched![2 * j]),
      Int32Array.from({ length: k }, (_, j) => sched![2 * j + 1]),
    );
  }
  sim.run(steps, job.record_spikes ? (i, s) => spikes.push(trial, s, i) : undefined);
  counts.set(sim.spikeCount, trial * net.n);
}
const seconds = (performance.now() - t0) / 1000;

writeFileSync(`${job.out}.counts.u32`, Buffer.from(counts.buffer));
if (job.record_spikes) writeFileSync(`${job.out}.spikes.i32`, Buffer.from(Int32Array.from(spikes).buffer));
const total = counts.reduce((a, b) => a + b, 0);
console.log(JSON.stringify({
  neurons: net.n,
  steps,
  trials: job.trials,
  wall_s: Number(seconds.toFixed(2)),
  realtime_factor: Number(((job.duration_ms / 1000) * job.trials / seconds).toFixed(3)),
  total_spikes: total,
}));
