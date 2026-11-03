// "Mode labo": silence part of the brain before the fly's move, like the silencing
// experiments of Shiu et al. 2024 (a silenced neuron's output synapses are set to 0).

import { create } from "zustand";
import type { BrainMeta, NeuronTable } from "../sim/network";

export interface LabPreset {
  /** Its label, in each language, is in ui/i18n.tsx (lab.presets). */
  id: string;
  /** Neurons whose main neuropil is one of these ROIs... */
  rois?: string[];
  /** ...or whose cell type is one of these, restricted to a side if given. */
  types?: string[];
  side?: "L" | "R";
}

export const LAB_PRESETS: LabPreset[] = [
  { id: "none" },
  { id: "ol-l", rois: ["LA(L)", "ME(L)", "AME(L)", "LO(L)", "LOP(L)", "Optic-unspecified(L)"] },
  { id: "ol-r", rois: ["LA(R)", "ME(R)", "AME(R)", "LO(R)", "LOP(R)", "Optic-unspecified(R)"] },
  { id: "dna02", types: ["DNa02"] },
  { id: "dna02-l", types: ["DNa02"], side: "L" },
  { id: "dna02-r", types: ["DNa02"], side: "R" },
];

/** Indices of the neurons silenced by a preset. */
export function presetNeurons(preset: LabPreset, meta: BrainMeta, neurons: NeuronTable): Int32Array {
  const out: number[] = [];
  for (const roi of preset.rois ?? []) {
    const r = meta.rois.find((x) => x.name === roi);
    if (r) for (let i = r.start; i < r.start + r.count; i++) out.push(i);
  }
  if (preset.types) {
    const typeIdx = new Set(preset.types.map((t) => meta.types.indexOf(t)).filter((i) => i >= 0));
    const side = preset.side ? meta.sides.indexOf(preset.side) : -1;
    for (let i = 0; i < neurons.type.length; i++) {
      if (typeIdx.has(neurons.type[i]) && (side < 0 || neurons.side[i] === side)) out.push(i);
    }
  }
  return Int32Array.from(out);
}

interface LabState {
  presetId: string;
  setPreset(id: string): void;
}

export const useLab = create<LabState>((set) => ({
  presetId: "none",
  setPreset(id) {
    set({ presetId: id });
  },
}));
