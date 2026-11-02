// The fly's move, decided in closed loop by its simulated DNa01/DNa02 only.
//
// Like a fly in a closed-loop arena: it starts with a random (seeded) heading; every
// window (50 ms) the scene is re-rendered for the current heading, L1-L3 are driven
// accordingly, the network runs, and the heading turns at a rotational velocity
//   omega = kDNa02 * (rate DNa02_R - rate DNa02_L) + kDNa01 * (rate DNa01_R - rate DNa01_L)
// (ipsilateral turning, right-left difference: Rayshubskiy et al. 2025), with gains and
// neural-to-behaviour lag measured on their recordings (08_calibrate_steering.py).
// The move is the column in front of the final heading. Only game-rule exception: if
// that column is full, the nearest free column in the direction of the heading.

import { Rng } from "../sim/rng";
import type { Network } from "../sim/lif";
import { SimSession } from "../sim/session";
import { lmcRates, sampleOmmatidia, type Column } from "../vision/eye";
import { BOARD, holeCenter, type Cells } from "../vision/geometry";
import { COLS, isColumnFull } from "../game/connect4";
import calibration from "./steering-calibration.json";

export interface DecisionParams {
  /** L1-L3 Poisson rate per unit of OFF (Weber) contrast, Hz. */
  gainHz: number;
  distanceCm: number;
  windowMs: number;
  minMs: number;
  maxMs: number;
  /** Stop once the heading moved less than stableDeg over the last stableMs (after minMs). */
  stableMs: number;
  stableDeg: number;
  /** deg/s of rotation per spike/s of right-minus-left activity. */
  kDNa02: number;
  kDNa01: number;
  lagMs: number;
  /** Initial heading drawn uniformly in [-initialHeadingMaxDeg, +initialHeadingMaxDeg]. */
  initialHeadingMaxDeg: number;
  /** Benchmark control: the fly sees red pieces as yellow and vice versa (rules unchanged). */
  swapPieceColors?: boolean;
}

export const DEFAULT_DECISION: DecisionParams = {
  gainHz: 400, // maximises the DNa02 steering signal (tools/fly-connectome/js/gain-sweep.ts, REPORT.md 4.2 and phase 7 fix)
  distanceCm: 20,
  windowMs: 50,
  minMs: 1000,
  maxMs: 3000,
  stableMs: 500,
  stableDeg: 1,
  kDNa02: calibration.DNa02.mean_slope_deg_s_per_hz,
  kDNa01: calibration.DNa01.mean_slope_deg_s_per_hz,
  lagMs: calibration.DNa02.mean_lag_ms,
  initialHeadingMaxDeg: 35,
};

export interface DecisionContext {
  net: Network;
  columns: readonly Column[];
  /** Input neurons and the column each one belongs to (vision/columns.ts inputColumns). */
  inputs: { targets: Int32Array; column: Int32Array };
  outputs: { DNa02_L: number; DNa02_R: number; DNa01_L: number; DNa01_R: number };
}

export interface WindowRecord {
  index: number;
  fromStep: number;
  toStep: number;
  /** Heading during this window (the scene the fly saw). */
  headingDeg: number;
  dn: { DNa02_L: number; DNa02_R: number; DNa01_L: number; DNa01_R: number };
  /** Rotation applied at the end of the window (from activity lagMs earlier), deg/s. */
  omegaDegS: number;
  steps: Int32Array;
  neurons: Int32Array;
}

export interface Decision {
  seed: number;
  initialHeadingDeg: number;
  finalHeadingDeg: number;
  aimedColumn: number;
  playedColumn: number;
  /** Set when the aimed column was full (game-rule fallback). */
  fallback: { from: number; to: number } | null;
  simulatedMs: number;
  stoppedBecause: "stable" | "max";
}

/** Azimuth (deg) of each column's centre seen from the fly, heading 0. */
export function columnAzimuths(distanceCm: number): number[] {
  return Array.from({ length: BOARD.cols }, (_, c) => (Math.atan2(holeCenter(c, 0)[0], distanceCm) * 180) / Math.PI);
}

export function columnInFront(headingDeg: number, distanceCm: number): number {
  const az = columnAzimuths(distanceCm);
  let best = 0;
  for (let c = 1; c < az.length; c++) if (Math.abs(az[c] - headingDeg) < Math.abs(az[best] - headingDeg)) best = c;
  return best;
}

/** Nearest free column, searching first on the side the heading points to. */
export function resolveFullColumn(cells: Cells, aimed: number, headingDeg: number, distanceCm: number): number {
  if (!isColumnFull(cells, aimed)) return aimed;
  const az = columnAzimuths(distanceCm);
  const first = headingDeg > az[aimed] ? 1 : headingDeg < az[aimed] ? -1 : aimed < (COLS - 1) / 2 ? 1 : -1;
  for (const dir of [first, -first]) {
    for (let c = aimed + dir; c >= 0 && c < COLS; c += dir) if (!isColumnFull(cells, c)) return c;
  }
  throw new Error("board is full");
}

export function* decide(
  ctx: DecisionContext,
  cells: Cells,
  seed: number,
  params: DecisionParams = DEFAULT_DECISION,
  silenced: ArrayLike<number> = [],
): Generator<WindowRecord, Decision> {
  const rng = new Rng(seed);
  // what the fly sees (the board itself, or the colour-swapped control)
  const seen = params.swapPieceColors ? cells.map((v) => (v === 1 ? 2 : v === 2 ? 1 : 0)) : cells;
  const initial = (2 * (rng.nextU32() / 4294967296) - 1) * params.initialHeadingMaxDeg;
  const session = new SimSession(ctx.net, (seed ^ 0x9e3779b9) >>> 0);
  session.reset((seed ^ 0x9e3779b9) >>> 0, silenced);
  // Silencing (Shiu et al.) mutes a neuron's output synapses. A descending neuron's output is
  // the steering command itself, so a silenced DN's spikes do not move the heading.
  const muted = new Set(Array.from(silenced));
  const counted = {
    DNa02_L: muted.has(ctx.outputs.DNa02_L) ? -1 : ctx.outputs.DNa02_L,
    DNa02_R: muted.has(ctx.outputs.DNa02_R) ? -1 : ctx.outputs.DNa02_R,
    DNa01_L: muted.has(ctx.outputs.DNa01_L) ? -1 : ctx.outputs.DNa01_L,
    DNa01_R: muted.has(ctx.outputs.DNa01_R) ? -1 : ctx.outputs.DNa01_R,
  };
  const stepsPerWindow = Math.round(params.windowMs / 0.1);
  const lagWindows = Math.max(0, Math.round(params.lagMs / params.windowMs));
  const maxWindows = Math.round(params.maxMs / params.windowMs);
  const minWindows = Math.round(params.minMs / params.windowMs);
  const stableWindows = Math.round(params.stableMs / params.windowMs);
  const dtS = params.windowMs / 1000;
  const { targets, column } = ctx.inputs;
  const rates = new Float64Array(targets.length);
  const pendingOmega: number[] = [];
  const headings: number[] = [];
  let heading = initial;
  let stoppedBecause: Decision["stoppedBecause"] = "max";

  for (let w = 0; w < maxWindows; w++) {
    const colRates = lmcRates(sampleOmmatidia(ctx.columns, seen, { distanceCm: params.distanceCm, headingDeg: heading }), params.gainHz);
    for (let i = 0; i < targets.length; i++) rates[i] = colRates[column[i]];
    if (w === 0) session.setInputs(targets, rates);
    else session.setRates(rates);
    const chunk = session.run(stepsPerWindow);
    const dn = { DNa02_L: 0, DNa02_R: 0, DNa01_L: 0, DNa01_R: 0 };
    for (const n of chunk.neurons) {
      if (n === counted.DNa02_L) dn.DNa02_L++;
      else if (n === counted.DNa02_R) dn.DNa02_R++;
      else if (n === counted.DNa01_L) dn.DNa01_L++;
      else if (n === counted.DNa01_R) dn.DNa01_R++;
    }
    pendingOmega.push(
      params.kDNa02 * ((dn.DNa02_R - dn.DNa02_L) / dtS) + params.kDNa01 * ((dn.DNa01_R - dn.DNa01_L) / dtS),
    );
    // Activity of window w moves the heading lagWindows later.
    const omega = pendingOmega.length > lagWindows ? pendingOmega.shift()! : 0;
    headings.push(heading);
    yield { index: w, fromStep: chunk.fromStep, toStep: chunk.toStep, headingDeg: heading, dn, omegaDegS: omega, steps: chunk.steps, neurons: chunk.neurons };
    heading += omega * dtS;
    if (w + 1 >= minWindows && headings.length >= stableWindows) {
      const past = headings[headings.length - stableWindows];
      if (Math.abs(heading - past) < params.stableDeg) {
        stoppedBecause = "stable";
        headings.push(heading);
        break;
      }
    }
  }

  const aimed = columnInFront(heading, params.distanceCm);
  const played = resolveFullColumn(cells, aimed, heading, params.distanceCm);
  return {
    seed,
    initialHeadingDeg: initial,
    finalHeadingDeg: heading,
    aimedColumn: aimed,
    playedColumn: played,
    fallback: played === aimed ? null : { from: aimed, to: played },
    simulatedMs: session.step * 0.1,
    stoppedBecause,
  };
}
