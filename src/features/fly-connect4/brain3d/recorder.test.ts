import { describe, expect, it } from "vitest";
import { SpikeRecorder } from "./recorder";

describe("spike recorder", () => {
  it("stores windows in order and answers time-range queries", () => {
    const r = new SpikeRecorder();
    r.append(Int32Array.from([0, 3, 3, 499]), Int32Array.from([5, 1, 2, 9]), 500);
    r.append(Int32Array.from([500, 700]), Int32Array.from([4, 4]), 1000);
    expect(r.count).toBe(6);
    expect(r.endStep).toBe(1000);
    expect(Array.from(r.range(3, 500).neurons)).toEqual([1, 2, 9]);
    expect(Array.from(r.range(0, 1).neurons)).toEqual([5]);
    expect(Array.from(r.range(800, 2000).neurons)).toEqual([]);
  });

  it("grows past its initial capacity", () => {
    const r = new SpikeRecorder();
    const n = 200_000;
    r.append(Int32Array.from({ length: n }, (_, i) => i), Int32Array.from({ length: n }, (_, i) => i % 7), n);
    expect(r.range(n - 10, n).steps.length).toBe(10);
    expect(r.range(n - 10, n).neurons[0]).toBe((n - 10) % 7);
  });

  it("rejects out-of-order windows and resets", () => {
    const r = new SpikeRecorder();
    r.append(Int32Array.from([10]), Int32Array.from([1]), 20);
    expect(() => r.append(Int32Array.from([5]), Int32Array.from([1]), 30)).toThrow();
    const v = r.version;
    r.reset();
    expect(r.count).toBe(0);
    expect(r.version).toBe(v + 1);
  });
});
