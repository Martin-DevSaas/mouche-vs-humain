// Optic-lobe columns (public/fly-brain/v1/columns.json) and the input neurons of each.

import type { BrainMeta, NeuronTable } from "../sim/network";
import type { Column } from "./eye";

export interface ColumnsFile {
  eye: ("L" | "R")[];
  p: number[];
  q: number[];
  az: number[];
  el: number[];
  dphi_deg: Record<string, number>;
}

export function parseColumns(f: ColumnsFile): Column[] {
  return f.eye.map((eye, i) => ({ eye, p: f.p[i], q: f.q[i], az: f.az[i], el: f.el[i] }));
}

/**
 * Poisson targets of the network: every L1/L2/L3 neuron with the index of the
 * column it belongs to. A column's rate drives all its lamina monopolar cells.
 */
export function inputColumns(meta: BrainMeta, neurons: NeuronTable, columns: readonly Column[]) {
  const key = (eye: string, p: number, q: number) => `${eye}:${p}:${q}`;
  const index = new Map(columns.map((c, i) => [key(c.eye, c.p, c.q), i]));
  const targets: number[] = [];
  const column: number[] = [];
  for (let i = 0; i < neurons.flags.length; i++) {
    if (!(neurons.flags[i] & meta.flags.input)) continue;
    const eye = meta.sides[neurons.side[i]];
    const c = index.get(key(eye, neurons.hex1[i], neurons.hex2[i]));
    if (c === undefined) throw new Error(`input neuron ${i} has no column`);
    targets.push(i);
    column.push(c);
  }
  return { targets: Int32Array.from(targets), column: Int32Array.from(column) };
}
