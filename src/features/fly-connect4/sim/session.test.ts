import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inputIndices, parseNetwork, parseNeurons, type BrainMeta } from "./network";
import { SimSession } from "./session";

const DIR = join(process.cwd(), "public/fly-brain/v1");
const buf = (f: string) => {
  const b = readFileSync(join(DIR, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe("SimSession on the real subnetwork", () => {
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as BrainMeta;
  const net = parseNetwork(meta, buf("network.bin"));
  const inputs = inputIndices(meta, parseNeurons(meta, buf("neurons.bin")));
  const targets = inputs.filter((_, k) => k % 3 === 0);
  const rates = new Float64Array(targets.length).fill(150);

  it("gives identical spikes whether run in one go or in 50 ms windows", () => {
    const a = new SimSession(net, 123);
    a.setInputs(targets, rates);
    const whole = a.run(1500);
    const b = new SimSession(net, 123);
    b.setInputs(targets, rates);
    const parts = [b.run(500), b.run(500), b.run(500)];
    expect(whole.steps.length).toBeGreaterThan(1000);
    expect(Array.from(whole.steps)).toEqual(parts.flatMap((p) => Array.from(p.steps)));
    expect(Array.from(whole.neurons)).toEqual(parts.flatMap((p) => Array.from(p.neurons)));
    expect(parts[2].toStep).toBe(1500);
  });

  it("is replayable: reset with the same seed reproduces the run", () => {
    const s = new SimSession(net, 9);
    s.setInputs(targets, rates);
    const first = s.run(800);
    s.reset(9);
    s.setInputs(targets, rates);
    const again = s.run(800);
    expect(Array.from(again.neurons)).toEqual(Array.from(first.neurons));
  });
}, 60000);
