// Input gain (global parameter #1) chosen to maximise the DN steering signal.
//
//   npx tsx tools/fly-connectome/js/gain-sweep.ts <out.json> <gain1,gain2,...> <count>
//
// Same random legal positions and headings for every gain (open loop, 1 s each); for
// each gain: mean DNa02 rate, mean |DNa02_R - DNa02_L|, and the correlation between the
// right-left difference and the board's horizontal offset in the fly's view.
// Gains are limited to the range the activity-based subnetwork was validated on.

import { readFileSync, writeFileSync } from "node:fs";
import { Rng } from "../../../src/features/fly-connect4/sim/rng";
import { parseNetwork, parseNeurons, type BrainMeta } from "../../../src/features/fly-connect4/sim/network";
import { SimSession } from "../../../src/features/fly-connect4/sim/session";
import { inputColumns, parseColumns, type ColumnsFile } from "../../../src/features/fly-connect4/vision/columns";
import { lmcRates, sampleOmmatidia } from "../../../src/features/fly-connect4/vision/eye";
import { BOARD } from "../../../src/features/fly-connect4/vision/geometry";

const [out, gainsArg, countArg] = process.argv.slice(2);
const D = "public/fly-brain/v1/";
const buf = (f: string) => {
  const b = readFileSync(D + f);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const meta = JSON.parse(readFileSync(D + "meta.json", "utf8")) as BrainMeta;
const net = parseNetwork(meta, buf("network.bin"));
const neurons = parseNeurons(meta, buf("neurons.bin"));
const columns = parseColumns(JSON.parse(readFileSync(D + "columns.json", "utf8")) as ColumnsFile);
const { targets, column } = inputColumns(meta, neurons, columns);
const o = meta.outputs;
const rng = new Rng(2024);
const uniform = () => rng.nextU32() / 4294967296;

const stimuli = Array.from({ length: Number(countArg) }, () => {
  const cells = new Uint8Array(BOARD.cols * BOARD.rows);
  const h = new Array(BOARD.cols).fill(0);
  let p = 1;
  for (let m = Math.floor(uniform() * 25); m > 0; m--) {
    const open = h.map((x, c) => (x < BOARD.rows ? c : -1)).filter((c) => c >= 0);
    const c = open[Math.floor(uniform() * open.length)];
    cells[h[c]++ * BOARD.cols + c] = p;
    p = 3 - p;
  }
  return { cells, heading: -35 + 70 * uniform() };
});

const results = [];
for (const gain of gainsArg.split(",").map(Number)) {
  const rows = stimuli.map((s, k) => {
    const rates = lmcRates(sampleOmmatidia(columns, s.cells, { distanceCm: 20, headingDeg: s.heading }), gain);
    const session = new SimSession(net, 300 + k);
    session.setInputs(targets, Float64Array.from(column, (c) => rates[c]));
    const c = session.run(10000);
    const n = (i: number) => c.neurons.filter((x) => x === i).length;
    return { heading: s.heading, a02L: n(o.DNa02_L), a02R: n(o.DNa02_R), a01L: n(o.DNa01_L), a01R: n(o.DNa01_R) };
  });
  const diff = rows.map((r) => r.a02R - r.a02L);
  // board offset in view: heading > 0 puts the board on the fly's left
  const offset = rows.map((r) => -r.heading);
  const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
  const corr = (x: number[], y: number[]) => {
    const mx = mean(x), my = mean(y);
    const sxy = x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0);
    const sx = Math.sqrt(x.reduce((a, xi) => a + (xi - mx) ** 2, 0));
    const sy = Math.sqrt(y.reduce((a, yi) => a + (yi - my) ** 2, 0));
    return sx && sy ? sxy / (sx * sy) : null;
  };
  const res = {
    gain,
    mean_DNa02_hz: mean(rows.map((r) => (r.a02L + r.a02R) / 2)),
    mean_abs_DNa02_diff_hz: mean(diff.map(Math.abs)),
    mean_DNa02_diff_hz: mean(diff),
    mean_DNa01_hz: mean(rows.map((r) => (r.a01L + r.a01R) / 2)),
    corr_diff_vs_board_offset: corr(diff, offset),
    rows,
  };
  console.log(JSON.stringify({ ...res, rows: undefined }));
  results.push(res);
}
writeFileSync(out, JSON.stringify(results, null, 1));
