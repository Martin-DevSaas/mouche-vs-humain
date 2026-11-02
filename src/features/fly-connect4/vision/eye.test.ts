import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNeurons, type BrainMeta } from "../sim/network";
import { inputColumns, parseColumns, type ColumnsFile } from "./columns";
import {
  acceptancePattern,
  DEFAULT_DISTANCE_CM,
  lmcRates,
  materialAlong,
  materialCatch,
  sampleOmmatidia,
  type Column,
} from "./eye";
import { BOARD, BOARD_HEIGHT, BOARD_WIDTH, Material, holeCenter, materialAt } from "./geometry";

const DIR = join(process.cwd(), "public/fly-brain/v1");
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as BrainMeta;
const nb = readFileSync(join(DIR, "neurons.bin"));
const neurons = parseNeurons(meta, nb.buffer.slice(nb.byteOffset, nb.byteOffset + nb.byteLength) as ArrayBuffer);
const columns = parseColumns(JSON.parse(readFileSync(join(DIR, "columns.json"), "utf8")) as ColumnsFile);
const pose = { distanceCm: DEFAULT_DISTANCE_CM, headingDeg: 0 };
const empty = () => new Uint8Array(BOARD.cols * BOARD.rows);

describe("spectral catches (Sharkey et al. 2020 sensitivities)", () => {
  it("red pieces look dark to R1-6, much darker than yellow", () => {
    expect(materialCatch(Material.Red, "R1-6")).toBeLessThan(0.25 * materialCatch(Material.Yellow, "R1-6"));
  });
  it("but the long-wavelength R8y still catches red light", () => {
    expect(materialCatch(Material.Red, "R8y")).toBeGreaterThan(5 * materialCatch(Material.Red, "R1-6"));
  });
});

describe("board geometry", () => {
  it("shows pieces in holes, the background through empty holes, plastic elsewhere", () => {
    const cells = empty();
    cells[0] = 1; // bottom-left red
    const [x, y] = holeCenter(0, 0);
    expect(materialAt(cells, x, y)).toBe(Material.Red);
    const [x2, y2] = holeCenter(1, 0);
    expect(materialAt(cells, x2, y2)).toBe(Material.Background);
    expect(materialAt(cells, x2 + BOARD.pitch / 2, y2)).toBe(Material.Board);
    expect(materialAt(cells, BOARD_WIDTH, 0)).toBe(Material.Background);
    expect(materialAt(cells, BOARD_WIDTH / 2 - 0.1, -BOARD_HEIGHT / 2 - 1)).toBe(Material.Board); // leg
  });

  it("turning the head shifts the board the other way in the fly's view", () => {
    const cells = empty();
    const [cx] = holeCenter(BOARD.cols - 1, 3);
    cells[3 * BOARD.cols + BOARD.cols - 1] = 2;
    const az = (Math.atan2(cx, DEFAULT_DISTANCE_CM) * 180) / Math.PI;
    const elRow3 = (Math.atan2(holeCenter(0, 3)[1], DEFAULT_DISTANCE_CM) * 180) / Math.PI;
    expect(materialAlong(cells, pose, az, elRow3)).toBe(Material.Yellow);
    expect(materialAlong(cells, { ...pose, headingDeg: 10 }, az - 10, elRow3)).toBe(Material.Yellow);
  });
});

describe("ommatidia sampling and LMC drive", () => {
  it("normalises the Gaussian acceptance weights", () => {
    const { w } = acceptancePattern();
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    expect(w.length).toBe(61);
  });

  it("maps every L1/L2/L3 neuron to a column", () => {
    const { targets, column } = inputColumns(meta, neurons, columns);
    const lmc = Array.from(neurons.type).filter((t) => ["L1", "L2", "L3"].includes(meta.types[t])).length;
    expect(targets.length).toBe(lmc);
    expect(Math.max(...column)).toBeLessThan(columns.length);
  });

  it("an empty board drives both eyes about equally, and only where the board is", () => {
    const rates = lmcRates(sampleOmmatidia(columns, empty(), pose), 150);
    const sum = (eye: Column["eye"]) => columns.reduce((s, c, i) => s + (c.eye === eye ? rates[i] : 0), 0);
    const l = sum("L");
    const r = sum("R");
    expect(Math.abs(l - r) / (l + r)).toBeLessThan(0.1);
    const behind = columns.findIndex((c) => Math.abs(c.az) > 120 && Math.abs(c.el) < 10);
    expect(rates[behind]).toBe(0);
  });

  it("a red piece excites its columns more than a yellow one (it is darker)", () => {
    const at = (cell: number) => {
      const cells = empty();
      cells[2 * BOARD.cols + 3] = cell; // centre column, row 2
      return lmcRates(sampleOmmatidia(columns, cells, pose), 150);
    };
    const [x, y] = holeCenter(3, 2);
    const az = (Math.atan2(x, DEFAULT_DISTANCE_CM) * 180) / Math.PI;
    const el = (Math.atan2(y, DEFAULT_DISTANCE_CM) * 180) / Math.PI;
    let best = 0;
    columns.forEach((c, i) => {
      if (Math.hypot(c.az - az, c.el - el) < Math.hypot(columns[best].az - az, columns[best].el - el)) best = i;
    });
    expect(at(1)[best]).toBeGreaterThan(at(2)[best]);
  });
});
