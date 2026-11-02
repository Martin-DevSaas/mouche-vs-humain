import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { drop, emptyBoard, isColumnFull, type Cells } from "../game/connect4";
import { parseNetwork, parseNeurons, type BrainMeta } from "../sim/network";
import { inputColumns, parseColumns, type ColumnsFile } from "../vision/columns";
import {
  DEFAULT_DECISION,
  columnAzimuths,
  columnInFront,
  decide,
  resolveFullColumn,
  type Decision,
  type DecisionContext,
  type WindowRecord,
} from "./decide";

const DIR = join(process.cwd(), "public/fly-brain/v1");
const buf = (f: string) => {
  const b = readFileSync(join(DIR, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

function fill(cells: Cells, col: number): Cells {
  let c = cells;
  while (!isColumnFull(c, col)) c = drop(c, col, 1).cells;
  return c;
}

describe("heading -> column", () => {
  const az = columnAzimuths(20);
  it("places the 7 columns symmetrically, about 10 deg apart at 20 cm", () => {
    expect(az[3]).toBeCloseTo(0, 10);
    expect(az[0]).toBeCloseTo(-az[6], 10);
    expect(az[4] - az[3]).toBeCloseTo(10.2, 1);
  });
  it("picks the column in front of the heading", () => {
    expect(columnInFront(0, 20)).toBe(3);
    expect(columnInFront(-60, 20)).toBe(0);
    expect(columnInFront(az[5] + 1, 20)).toBe(5);
  });
  it("falls back to the nearest free column on the side the heading points to", () => {
    const cells = fill(emptyBoard(), 3);
    expect(resolveFullColumn(cells, 3, az[3] + 2, 20)).toBe(4);
    expect(resolveFullColumn(cells, 3, az[3] - 2, 20)).toBe(2);
    const edge = fill(fill(emptyBoard(), 6), 5);
    expect(resolveFullColumn(edge, 6, az[6] + 5, 20)).toBe(4); // nothing to the right: go back left
    expect(resolveFullColumn(emptyBoard(), 2, 0, 20)).toBe(2);
  });
});

describe("closed-loop decision on the real subnetwork", () => {
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as BrainMeta;
  const net = parseNetwork(meta, buf("network.bin"));
  const neurons = parseNeurons(meta, buf("neurons.bin"));
  const columns = parseColumns(JSON.parse(readFileSync(join(DIR, "columns.json"), "utf8")) as ColumnsFile);
  const o = meta.outputs;
  const ctx: DecisionContext = {
    net,
    columns,
    inputs: inputColumns(meta, neurons, columns),
    outputs: { DNa02_L: o.DNa02_L, DNa02_R: o.DNa02_R, DNa01_L: o.DNa01_L, DNa01_R: o.DNa01_R },
  };
  const params = { ...DEFAULT_DECISION, minMs: 200, maxMs: 400 };

  function run(seed: number, cells = emptyBoard()) {
    const gen = decide(ctx, cells, seed, params);
    const windows: WindowRecord[] = [];
    for (;;) {
      const r = gen.next();
      if (r.done) return { windows, decision: r.value as Decision };
      windows.push(r.value);
    }
  }

  it("is reproducible from its seed and plays a legal column", () => {
    const a = run(7);
    const b = run(7);
    expect(b.decision).toEqual(a.decision);
    expect(b.windows.map((w) => w.headingDeg)).toEqual(a.windows.map((w) => w.headingDeg));
    expect(a.decision.playedColumn).toBeGreaterThanOrEqual(0);
    expect(a.decision.playedColumn).toBeLessThan(7);
    expect(a.windows[0].fromStep).toBe(0);
    expect(a.windows[1].fromStep).toBe(500);
  });

  it("changes the heading only through DN spikes", () => {
    const { windows, decision } = run(11);
    let heading = decision.initialHeadingDeg;
    for (const w of windows) {
      expect(w.headingDeg).toBeCloseTo(heading, 9);
      heading += (w.omegaDegS * params.windowMs) / 1000;
    }
    expect(decision.finalHeadingDeg).toBeCloseTo(heading, 9);
  });

  it("never plays a full column", () => {
    let cells = emptyBoard();
    for (let c = 0; c < 7; c++) if (c !== 1) cells = fill(cells, c);
    expect(run(3, cells).decision.playedColumn).toBe(1);
  });

  it("ignores the spikes of silenced DNs (their output is the steering command)", () => {
    const all = [o.DNa02_L, o.DNa02_R, o.DNa01_L, o.DNa01_R];
    const gen = decide(ctx, emptyBoard(), 5, { ...params, gainHz: 600 }, all);
    let r = gen.next();
    while (!r.done) {
      expect(r.value.omegaDegS).toBe(0);
      r = gen.next();
    }
    expect((r.value as Decision).finalHeadingDeg).toBe((r.value as Decision).initialHeadingDeg);
  });
}, 120000);
