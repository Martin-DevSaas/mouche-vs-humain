import { describe, expect, it } from "vitest";
import type { BrainMeta, NeuronTable } from "../sim/network";
import { explainDecision } from "./explain";

const meta = {
  types: ["L1", "Tm3", "LC10a", "DNa02"],
  flags: { input: 1, output: 2, inhibitory: 4, soma: 8 },
} as unknown as BrainMeta;
// 0: L1 (hop 0), 1: L1, 2: Tm3 (1), 3: LC10a (2), 4: DNa02 output (3)
const neurons = {
  type: Uint16Array.from([0, 0, 1, 2, 3]),
  hops: Uint8Array.from([0, 0, 1, 2, 3]),
  flags: Uint8Array.from([1, 1, 0, 0, 2]),
} as unknown as NeuronTable;

describe("decision explanation", () => {
  it("groups spikes by distance from the inputs, outputs apart", () => {
    const levels = explainDecision(meta, neurons, Int32Array.from([0, 1, 1, 2, 3, 3, 3, 4]));
    expect(levels[0]).toMatchObject({ label: "Entrée (L1–L3)", spikes: 3, types: [{ type: "L1", spikes: 3, neurons: 2 }] });
    expect(levels[1].types).toEqual([{ type: "Tm3", spikes: 1, neurons: 1 }]);
    expect(levels[2].types).toEqual([{ type: "LC10a", spikes: 3, neurons: 1 }]);
    expect(levels[3].spikes).toBe(0);
    expect(levels[5]).toMatchObject({ label: "Sortie (DNa01/DNa02)", spikes: 1, types: [{ type: "DNa02", spikes: 1, neurons: 1 }] });
  });
});
