// Game-like visual stimuli for the activity-based subnetwork selection.
//
//   npx tsx tools/fly-connectome/js/stimuli.ts <out.json> <count> <seed> <gain1,gain2,...>
//
// Each stimulus: a random legal position (random play with gravity, 0-30 moves),
// a heading in [-40, 40] deg, a gain; output = per-column L1-L3 Poisson rate (Hz),
// computed with the front-end vision module (columns order of columns.json).

import { readFileSync, writeFileSync } from "node:fs";
import { Rng } from "../../../src/features/fly-connect4/sim/rng";
import { parseColumns, type ColumnsFile } from "../../../src/features/fly-connect4/vision/columns";
import { DEFAULT_DISTANCE_CM, lmcRates, sampleOmmatidia } from "../../../src/features/fly-connect4/vision/eye";
import { BOARD } from "../../../src/features/fly-connect4/vision/geometry";

const [out, countArg, seedArg, gainsArg] = process.argv.slice(2);
const columns = parseColumns(JSON.parse(readFileSync("public/fly-brain/v1/columns.json", "utf8")) as ColumnsFile);
const rng = new Rng(Number(seedArg));
const gains = gainsArg.split(",").map(Number);
const uniform = () => rng.nextU32() / 4294967296;

function randomPosition(): Uint8Array {
  const cells = new Uint8Array(BOARD.cols * BOARD.rows);
  const heights = new Array(BOARD.cols).fill(0);
  const moves = Math.floor(uniform() * 31);
  let player = uniform() < 0.5 ? 1 : 2;
  for (let m = 0; m < moves; m++) {
    const open = heights.map((h, c) => (h < BOARD.rows ? c : -1)).filter((c) => c >= 0);
    const c = open[Math.floor(uniform() * open.length)];
    cells[heights[c] * BOARD.cols + c] = player;
    heights[c]++;
    player = 3 - player;
  }
  return cells;
}

const stimuli = [];
for (let k = 0; k < Number(countArg); k++) {
  const cells = randomPosition();
  const headingDeg = -40 + 80 * uniform();
  const gainHz = gains[k % gains.length];
  const catches = sampleOmmatidia(columns, cells, { distanceCm: DEFAULT_DISTANCE_CM, headingDeg });
  const rates = lmcRates(catches, gainHz);
  stimuli.push({
    id: k,
    cells: Array.from(cells),
    heading_deg: Number(headingDeg.toFixed(3)),
    gain_hz: gainHz,
    rates_hz: Array.from(rates, (r) => Number(r.toFixed(4))),
  });
}
writeFileSync(out, JSON.stringify({ columns: columns.length, stimuli }));
console.log(`${stimuli.length} stimuli -> ${out}`);
