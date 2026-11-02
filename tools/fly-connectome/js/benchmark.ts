// Headless benchmark: the fly (same decide() as the web page, same assets) against
// benchmark opponents. One JSON line per game, appended to <out.jsonl>; games already in
// the file are skipped, so the run can be resumed. Shards split the games between processes.
//
//   npx tsx tools/fly-connectome/js/benchmark.ts <out.jsonl> <opponent> <games> [--shard i/n]
//        [--control dna02|swap] [--player fly|random]
//
// opponent: random | minimax1 | minimax3 | minimax5
// --player random replaces the fly by a random player (chance baseline, no simulation).
// The fly plays first in even-numbered games, second in odd ones.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { drop, emptyBoard, outcome, type Cells, type Player } from "../../../src/features/fly-connect4/game/connect4";
import { minimaxMove, randomMove } from "../../../src/features/fly-connect4/game/opponents";
import { moveSeed } from "../../../src/features/fly-connect4/game/store";
import { DEFAULT_DECISION, decide, type DecisionContext } from "../../../src/features/fly-connect4/motor/decide";
import { parseNetwork, parseNeurons, type BrainMeta } from "../../../src/features/fly-connect4/sim/network";
import { Rng } from "../../../src/features/fly-connect4/sim/rng";
import { inputColumns, parseColumns, type ColumnsFile } from "../../../src/features/fly-connect4/vision/columns";

const [out, opponent, gamesArg, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const [shard, shards] = (flag("--shard") ?? "0/1").split("/").map(Number);
const control = flag("--control") ?? "none";
const player = flag("--player") ?? "fly";
const games = Number(gamesArg);
const FLY: Player = 2;
const OPP: Player = 1;

const D = "public/fly-brain/v1/";
const buf = (f: string) => {
  const b = readFileSync(D + f);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const meta = JSON.parse(readFileSync(D + "meta.json", "utf8")) as BrainMeta;
const net = parseNetwork(meta, buf("network.bin"));
const neurons = parseNeurons(meta, buf("neurons.bin"));
const columns = parseColumns(JSON.parse(readFileSync(D + "columns.json", "utf8")) as ColumnsFile);
const o = meta.outputs;
const ctx: DecisionContext = {
  net,
  columns,
  inputs: inputColumns(meta, neurons, columns),
  outputs: { DNa02_L: o.DNa02_L, DNa02_R: o.DNa02_R, DNa01_L: o.DNa01_L, DNa01_R: o.DNa01_R },
};
const silenced = control === "dna02" ? [o.DNa02_L, o.DNa02_R] : [];
const params = { ...DEFAULT_DECISION, swapPieceColors: control === "swap" };

const done = new Set<number>();
if (existsSync(out)) {
  for (const line of readFileSync(out, "utf8").split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (r.opponent === opponent && r.control === control && r.player === player) done.add(r.game);
  }
}

function opponentMove(cells: Cells, rng: Rng): number {
  if (opponent === "random") return randomMove(cells, rng);
  const depth = Number(opponent.replace("minimax", ""));
  return minimaxMove(cells, OPP, depth, rng);
}

for (let g = shard; g < games; g += shards) {
  if (done.has(g)) continue;
  const t0 = performance.now();
  const gameSeed = (0x5eed0000 + g * 7919) >>> 0;
  const rng = new Rng(gameSeed ^ 0xabcdef);
  const flyFirst = g % 2 === 0;
  let cells = emptyBoard();
  let turn: Player = flyFirst ? FLY : OPP;
  const moves: number[] = [];
  const fly: { col: number; aimed: number; init: number; final: number; simMs: number; dn: number }[] = [];
  let flyMoveIndex = 0;
  while (outcome(cells).kind === "playing") {
    let col: number;
    if (turn === OPP) col = opponentMove(cells, rng);
    else if (player === "random") col = randomMove(cells, rng);
    else {
      const gen = decide(ctx, cells, moveSeed(gameSeed, flyMoveIndex++), params, silenced);
      let dn = 0;
      let r = gen.next();
      while (!r.done) {
        dn += r.value.dn.DNa02_L + r.value.dn.DNa02_R + r.value.dn.DNa01_L + r.value.dn.DNa01_R;
        r = gen.next();
      }
      const d = r.value;
      col = d.playedColumn;
      fly.push({
        col,
        aimed: d.aimedColumn,
        init: Number(d.initialHeadingDeg.toFixed(2)),
        final: Number(d.finalHeadingDeg.toFixed(2)),
        simMs: d.simulatedMs,
        dn,
      });
    }
    moves.push(col);
    cells = drop(cells, col, turn).cells;
    turn = (3 - turn) as Player;
  }
  const res = outcome(cells);
  const result = res.kind === "win" ? (res.player === FLY ? "win" : "loss") : "draw";
  const line = {
    opponent, control, player, game: g, gameSeed, flyFirst, result, moves, fly,
    wallS: Number(((performance.now() - t0) / 1000).toFixed(1)),
  };
  appendFileSync(out, JSON.stringify(line) + "\n");
  if (player === "fly") console.log(`${opponent} ${control} game ${g}: ${result} in ${moves.length} moves (${line.wallS} s)`);
}
