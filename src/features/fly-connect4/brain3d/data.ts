// Brain data for the map (main thread): neuron positions/attributes and region ranges.
// The network itself stays in the worker; only its strongest edges come back (topEdges).

import { parseNeurons, type BrainMeta, type NeuronTable } from "../sim/network";

/** Display frame: centre of the brain (µm), and scale µm -> scene units. Rotation pi about x
 * turns MaleCNS (y ventral, z posterior) into a frontal view (y up, anterior toward the viewer). */
export const BRAIN_CENTER: [number, number, number] = [384, 237, 247];
export const BRAIN_SCALE = 0.05;

export const SUPERCLASS_COLORS: Record<string, string> = {
  ol_intrinsic: "#4f7cff",
  ol_sensory: "#7aa2ff",
  visual_projection: "#2fd3a0",
  visual_centrifugal: "#8be9c7",
  cb_intrinsic: "#ffb547",
  cb_sensory: "#ffd27a",
  cb_motor: "#ff7a59",
  descending_neuron: "#ff5470",
  ascending_neuron: "#c792ff",
  vnc_intrinsic: "#9aa4b2",
  vnc_motor: "#ff7a59",
};

export interface BrainData {
  meta: BrainMeta;
  neurons: NeuronTable;
  n: number;
  /** Region (meta.rois index) of each neuron. */
  roi: Uint8Array;
  regionCount: Int32Array;
  colors: Float32Array;
  sizes: Float32Array;
  outputs: { key: string; index: number; side: "L" | "R" }[];
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export async function loadBrainData(baseUrl: string): Promise<BrainData> {
  const [meta, buf] = await Promise.all([
    fetch(`${baseUrl}/meta.json`).then((r) => r.json() as Promise<BrainMeta>),
    fetch(`${baseUrl}/neurons.bin`).then((r) => r.arrayBuffer()),
  ]);
  const neurons = parseNeurons(meta, buf);
  const n = meta.counts.neurons;
  const regionCount = new Int32Array(meta.rois.length);
  for (const [i, r] of meta.rois.entries()) regionCount[i] = r.count;
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sc = meta.superclasses[neurons.superclass[i]];
    const [r, g, b] = hexToRgb(SUPERCLASS_COLORS[sc] ?? "#9aa4b2");
    colors.set([r, g, b], i * 3);
    sizes[i] = neurons.flags[i] & meta.flags.output ? 4 : sc === "descending_neuron" ? 1.6 : 1;
  }
  const outputs = Object.entries(meta.outputs).map(([key, index]) => ({
    key,
    index,
    side: key.endsWith("_L") ? ("L" as const) : ("R" as const),
  }));
  return { meta, neurons, n, roi: neurons.roi, regionCount, colors, sizes, outputs };
}
