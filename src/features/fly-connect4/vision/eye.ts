// What the fly sees: board -> ommatidia -> photoreceptor catches -> L1/L2/L3 Poisson rates.
//
// Geometry: the fly sits facing the board centre at distanceCm, at the height of the
// board centre, heading headingDeg (yaw; + = turned to its right). Ray directions use
// x forward, y right, z up; azimuth > 0 is to the fly's right.
// Each ommatidium integrates light over a Gaussian acceptance function of half-width
// acceptanceDeg (light-adapted R1-6, Juusola et al. 2017 eLife: 7.7 deg).
// Colours -> catches: spectral.json (03b_spectral.py; Sharkey et al. 2020 peaks).

import spectral from "./spectral.json";
import { Material, materialAt, type Cells } from "./geometry";

export const RECEPTORS = ["R1-6", "R7p", "R7y", "R8p", "R8y"] as const;
export type Receptor = (typeof RECEPTORS)[number];
const NR = RECEPTORS.length;

export interface Column {
  eye: "L" | "R";
  p: number;
  q: number;
  /** Viewing direction, degrees. */
  az: number;
  el: number;
}

export interface FlyPose {
  distanceCm: number;
  headingDeg: number;
}

export const DEFAULT_DISTANCE_CM = 20;
export const ACCEPTANCE_DEG = 7.7;

const MATERIAL_KEYS = ["background", "board", "red", "yellow"] as const;
/** catch[material * NR + receptor], relative to a white reflector. */
const CATCH = new Float64Array(MATERIAL_KEYS.length * NR);
MATERIAL_KEYS.forEach((m, mi) =>
  RECEPTORS.forEach((r, ri) => {
    CATCH[mi * NR + ri] = (spectral.catch_relative_to_white as Record<string, Record<string, number>>)[m][r];
  }),
);

export function materialCatch(m: Material, r: Receptor): number {
  return CATCH[m * NR + RECEPTORS.indexOf(r)];
}

/** Sample offsets (deg) and weights of a Gaussian acceptance function: rings at 0.6 sigma steps. */
export function acceptancePattern(acceptanceDeg = ACCEPTANCE_DEG) {
  const sigma = acceptanceDeg / (2 * Math.sqrt(2 * Math.LN2));
  const du: number[] = [];
  const dv: number[] = [];
  const w: number[] = [];
  for (let k = 0; k <= 4; k++) {
    const r = k * 0.6 * sigma;
    const n = k === 0 ? 1 : 6 * k;
    for (let j = 0; j < n; j++) {
      const a = (2 * Math.PI * j) / n;
      du.push(r * Math.cos(a));
      dv.push(r * Math.sin(a));
      w.push(Math.exp(-(r * r) / (2 * sigma * sigma)));
    }
  }
  const total = w.reduce((s, x) => s + x, 0);
  return { du: Float64Array.from(du), dv: Float64Array.from(dv), w: Float64Array.from(w, (x) => x / total) };
}

const DEG = Math.PI / 180;

/** Material hit by a ray from the fly along (az, el) in fly coordinates. */
export function materialAlong(cells: Cells, pose: FlyPose, azDeg: number, elDeg: number): Material {
  const az = (azDeg + pose.headingDeg) * DEG; // world azimuth
  const el = elDeg * DEG;
  const dx = Math.cos(el) * Math.cos(az);
  if (dx <= 1e-9) return Material.Background; // looking away from the board
  const t = pose.distanceCm / dx;
  const y = t * Math.cos(el) * Math.sin(az);
  const z = t * Math.sin(el);
  return materialAt(cells, y, z);
}

/**
 * Photoreceptor catches of every ommatidium: out[i * 5 + r] for column i and
 * receptor r (order RECEPTORS).
 */
export function sampleOmmatidia(
  columns: readonly Column[],
  cells: Cells,
  pose: FlyPose,
  pattern = acceptancePattern(),
  out = new Float32Array(columns.length * NR),
): Float32Array {
  const { du, dv, w } = pattern;
  const acc = new Float64Array(NR);
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    const cosEl = Math.max(Math.cos(c.el * DEG), 0.05);
    acc.fill(0);
    for (let k = 0; k < w.length; k++) {
      const m = materialAlong(cells, pose, c.az + du[k] / cosEl, c.el + dv[k]);
      for (let r = 0; r < NR; r++) acc[r] += w[k] * CATCH[m * NR + r];
    }
    for (let r = 0; r < NR; r++) out[i * NR + r] = acc[r];
  }
  return out;
}

/**
 * Drive of the lamina monopolar cells of each column, as Poisson rates (Hz).
 * L1-L3 depolarise to light decrements (OFF; e.g. Laughlin 1981, Clark et al. 2011):
 * rate = gainHz * max(0, -c), with c the Weber contrast of the R1-6 catch against
 * the mean over both eyes (global light adaptation).
 */
export function lmcRates(catches: Float32Array, gainHz: number, out = new Float64Array(catches.length / NR)) {
  const n = catches.length / NR;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += catches[i * NR];
  mean /= n;
  for (let i = 0; i < n; i++) {
    const c = (catches[i * NR] - mean) / mean;
    out[i] = gainHz * Math.max(0, -c);
  }
  return out;
}
