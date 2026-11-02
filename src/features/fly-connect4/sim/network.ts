// Reader for public/fly-brain/v1 (format documented in tools/fly-connectome/README.md).
// Arrays are views into the fetched buffers, no copy.

import type { Network } from "./lif";

interface ArrayLayout {
  offset: number;
  length: number;
  dtype: "uint32" | "uint16" | "int16" | "int32" | "uint8" | "int8" | "float32";
}

export interface BrainMeta {
  format: string;
  dataset: string;
  license: string;
  attribution: string;
  counts: { neurons: number; connections: number; synapses: number };
  files: {
    "network.bin": { bytes: number; layout: Record<string, ArrayLayout> };
    "neurons.bin": { bytes: number; layout: Record<string, ArrayLayout> };
  };
  flags: { input: number; output: number; inhibitory: number; soma: number };
  sides: string[];
  types: string[];
  superclasses: string[];
  nts: string[];
  rois: { name: string; start: number; count: number; mesh: boolean }[];
  meshes: string[];
  outputs: Record<string, number>;
  input_types: string[];
}

export interface NeuronTable {
  position: Float32Array;
  bodyId: Uint32Array;
  type: Uint16Array;
  superclass: Uint8Array;
  side: Uint8Array;
  roi: Uint8Array;
  nt: Uint8Array;
  flags: Uint8Array;
  hops: Uint8Array;
  hex1: Int8Array;
  hex2: Int8Array;
}

const CTORS = {
  uint32: Uint32Array,
  uint16: Uint16Array,
  int16: Int16Array,
  int32: Int32Array,
  uint8: Uint8Array,
  int8: Int8Array,
  float32: Float32Array,
} as const;

function view(buf: ArrayBuffer, l: ArrayLayout) {
  if (buf.byteLength < l.offset) throw new Error("truncated asset");
  return new CTORS[l.dtype](buf, l.offset, l.length);
}

export function parseNetwork(meta: BrainMeta, buf: ArrayBuffer): Network {
  const l = meta.files["network.bin"].layout;
  if (buf.byteLength !== meta.files["network.bin"].bytes) throw new Error("network.bin size mismatch");
  const net: Network = {
    n: meta.counts.neurons,
    offsets: view(buf, l.offsets) as Uint32Array,
    targets: view(buf, l.targets) as Uint16Array,
    weights: view(buf, l.weights) as Int16Array,
  };
  if (net.offsets.length !== net.n + 1 || net.offsets[net.n] !== net.targets.length) {
    throw new Error("network.bin is inconsistent with meta.json");
  }
  return net;
}

export function parseNeurons(meta: BrainMeta, buf: ArrayBuffer): NeuronTable {
  const l = meta.files["neurons.bin"].layout;
  if (buf.byteLength !== meta.files["neurons.bin"].bytes) throw new Error("neurons.bin size mismatch");
  const out = {} as Record<string, unknown>;
  for (const [name, layout] of Object.entries(l)) out[name] = view(buf, layout);
  return out as unknown as NeuronTable;
}

/** Indices of the input neurons (L1/L2/L3), in index order. */
export function inputIndices(meta: BrainMeta, neurons: NeuronTable): Int32Array {
  const out: number[] = [];
  for (let i = 0; i < neurons.flags.length; i++) if (neurons.flags[i] & meta.flags.input) out.push(i);
  return Int32Array.from(out);
}

/** The k strongest outgoing connections of every neuron (by |synapse count|), -1 when fewer exist. */
export function topEdges(net: Network, k: number): { targets: Int32Array; weights: Int16Array } {
  const targets = new Int32Array(net.n * k).fill(-1);
  const weights = new Int16Array(net.n * k);
  for (let i = 0; i < net.n; i++) {
    const start = net.offsets[i];
    const end = net.offsets[i + 1];
    for (let e = start; e < end; e++) {
      const w = net.weights[e];
      // insertion into the sorted top-k list of neuron i
      let slot = -1;
      for (let j = 0; j < k; j++) {
        if (targets[i * k + j] < 0 || Math.abs(w) > Math.abs(weights[i * k + j])) {
          slot = j;
          break;
        }
      }
      if (slot < 0) continue;
      for (let j = k - 1; j > slot; j--) {
        targets[i * k + j] = targets[i * k + j - 1];
        weights[i * k + j] = weights[i * k + j - 1];
      }
      targets[i * k + slot] = net.targets[e];
      weights[i * k + slot] = w;
    }
  }
  return { targets, weights };
}
