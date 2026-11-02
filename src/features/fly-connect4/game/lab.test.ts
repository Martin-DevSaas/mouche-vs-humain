import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNeurons, type BrainMeta } from "../sim/network";
import { LAB_PRESETS, presetNeurons } from "./lab";

const DIR = join(process.cwd(), "public/fly-brain/v1");
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as BrainMeta;
const b = readFileSync(join(DIR, "neurons.bin"));
const neurons = parseNeurons(meta, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
const preset = (id: string) => LAB_PRESETS.find((p) => p.id === id)!;

describe("lab silencing presets", () => {
  it("silences nothing by default", () => {
    expect(presetNeurons(preset("none"), meta, neurons).length).toBe(0);
  });

  it("selects the neurons of the optic lobe, on the right side only", () => {
    const ol = presetNeurons(preset("ol-l"), meta, neurons);
    expect(ol.length).toBeGreaterThan(100);
    for (const i of ol) expect(meta.rois[neurons.roi[i]].name).toMatch(/\(L\)$/);
  });

  it("selects DNa02 by side", () => {
    const both = presetNeurons(preset("dna02"), meta, neurons);
    const left = presetNeurons(preset("dna02-l"), meta, neurons);
    expect(Array.from(both).sort()).toEqual([meta.outputs.DNa02_L, meta.outputs.DNa02_R].sort());
    expect(Array.from(left)).toEqual([meta.outputs.DNa02_L]);
  });

  it("every preset (except 'none') silences at least one neuron", () => {
    for (const p of LAB_PRESETS.filter((x) => x.id !== "none")) {
      expect(presetNeurons(p, meta, neurons).length, p.id).toBeGreaterThan(0);
    }
  });
});
