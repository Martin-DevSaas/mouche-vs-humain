import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inputIndices, parseNetwork, parseNeurons, topEdges, type BrainMeta } from "./network";

const DIR = join(process.cwd(), "public/fly-brain/v1");
const buf = (f: string) => {
  const b = readFileSync(join(DIR, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe("public/fly-brain/v1 assets", () => {
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as BrainMeta;
  const net = parseNetwork(meta, buf("network.bin"));
  const neurons = parseNeurons(meta, buf("neurons.bin"));

  it("has a consistent CSR network", () => {
    expect(net.n).toBe(meta.counts.neurons);
    expect(net.targets.length).toBe(meta.counts.connections);
    for (let i = 0; i < net.n; i++) expect(net.offsets[i + 1]).toBeGreaterThanOrEqual(net.offsets[i]);
    expect(Math.max(...net.targets.subarray(0, 100000))).toBeLessThan(net.n);
  });

  it("exposes the four descending output neurons", () => {
    const names = Object.keys(meta.outputs).sort();
    expect(names).toEqual(["DNa01_L", "DNa01_R", "DNa02_L", "DNa02_R"]);
    for (const [name, i] of Object.entries(meta.outputs)) {
      expect(meta.types[neurons.type[i]]).toBe(name.split("_")[0]);
      expect(neurons.flags[i] & meta.flags.output).toBeTruthy();
    }
  });

  it("has L1/L2/L3 inputs with a hex column each", () => {
    const inputs = inputIndices(meta, neurons);
    const lmc = Array.from(neurons.type).filter((t) => ["L1", "L2", "L3"].includes(meta.types[t])).length;
    expect(inputs.length).toBe(lmc);
    expect(lmc).toBeGreaterThan(5000);
    for (const i of inputs) {
      expect(["L1", "L2", "L3"]).toContain(meta.types[neurons.type[i]]);
      expect(neurons.hex1[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("signs every connection by its presynaptic neuron", () => {
    for (let i = 0; i < net.n; i += 97) {
      const inh = (neurons.flags[i] & meta.flags.inhibitory) !== 0;
      for (let e = net.offsets[i]; e < net.offsets[i + 1]; e++) expect(net.weights[e] < 0).toBe(inh);
    }
  });

  it("finds the strongest outgoing connections of each neuron", () => {
    const { targets, weights } = topEdges(net, 3);
    for (let i = 0; i < net.n; i += 211) {
      const all = [];
      for (let e = net.offsets[i]; e < net.offsets[i + 1]; e++) all.push(Math.abs(net.weights[e]));
      all.sort((a, b) => b - a);
      const got = [0, 1, 2].filter((j) => targets[i * 3 + j] >= 0).map((j) => Math.abs(weights[i * 3 + j]));
      expect(got).toEqual(all.slice(0, 3));
    }
  });
});
