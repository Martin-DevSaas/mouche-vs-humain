// "Pourquoi elle a joué ici": the most active cell types of the input -> output chain
// during one decision, grouped by distance (in synapses) from the L1-L3 inputs.
// Activity is a correlate of the decision, not a causal proof (see the lab mode for that).

import type { BrainMeta, NeuronTable } from "../sim/network";

export interface ChainLevel {
  hops: number;
  label: string;
  types: { type: string; spikes: number; neurons: number }[];
  spikes: number;
}

export function explainDecision(
  meta: BrainMeta,
  neurons: NeuronTable,
  spikeNeurons: Int32Array,
  topPerLevel = 3,
): ChainLevel[] {
  const maxHops = 4;
  const perLevel = new Map<number, Map<number, { spikes: number; set: Set<number> }>>();
  const levelSpikes = new Array(maxHops + 2).fill(0);
  for (let i = 0; i < spikeNeurons.length; i++) {
    const n = spikeNeurons[i];
    const isOutput = (neurons.flags[n] & meta.flags.output) !== 0;
    const level = isOutput ? maxHops + 1 : Math.min(maxHops, neurons.hops[n]);
    levelSpikes[level]++;
    let byType = perLevel.get(level);
    if (!byType) perLevel.set(level, (byType = new Map()));
    const t = neurons.type[n];
    let e = byType.get(t);
    if (!e) byType.set(t, (e = { spikes: 0, set: new Set() }));
    e.spikes++;
    e.set.add(n);
  }
  const label = (h: number) =>
    h === 0
      ? "Entrée (L1–L3)"
      : h === maxHops + 1
        ? "Sortie (DNa01/DNa02)"
        : h === maxHops
          ? `${maxHops} relais ou plus`
          : `${h} relais après l'entrée`;
  const out: ChainLevel[] = [];
  for (let h = 0; h <= maxHops + 1; h++) {
    const byType = perLevel.get(h);
    const types = byType
      ? [...byType.entries()]
          .map(([t, e]) => ({ type: meta.types[t], spikes: e.spikes, neurons: e.set.size }))
          .sort((a, b) => b.spikes - a.spikes)
          .slice(0, h === maxHops + 1 ? 4 : topPerLevel)
      : [];
    out.push({ hops: h, label: label(h), types, spikes: levelSpikes[h] });
  }
  return out;
}
