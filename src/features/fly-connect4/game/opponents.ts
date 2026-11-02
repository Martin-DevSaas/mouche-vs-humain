// Benchmark opponents: a uniformly random player and a depth-limited minimax
// (alpha-beta, classic window heuristic). Ties between equally good moves are broken
// with a seeded RNG so that games vary.

import { Rng } from "../sim/rng";
import { COLS, ROWS, drop, legalColumns, winningLine, type Cells, type Player } from "./connect4";

export function randomMove(cells: Cells, rng: Rng): number {
  const legal = legalColumns(cells);
  return legal[rng.nextU32() % legal.length];
}

const WIN = 1_000_000;

/** Heuristic value of a position for `player` (Allis-style windows of 4 + centre control). */
export function evaluate(cells: Cells, player: Player): number {
  const opp = (3 - player) as Player;
  let score = 0;
  for (let r = 0; r < ROWS; r++) if (cells[r * COLS + 3] === player) score += 3;
  const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dc, dr] of dirs) {
        const ec = c + 3 * dc;
        const er = r + 3 * dr;
        if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k++) {
          const v = cells[(r + k * dr) * COLS + c + k * dc];
          if (v === player) mine++;
          else if (v === opp) theirs++;
        }
        if (mine && theirs) continue;
        if (mine === 3) score += 5;
        else if (mine === 2) score += 2;
        if (theirs === 3) score -= 4;
      }
    }
  }
  return score;
}

function negamax(cells: Cells, player: Player, depth: number, alpha: number, beta: number): number {
  const opp = (3 - player) as Player;
  if (winningLine(cells, opp)) return -WIN - depth; // the previous move won: prefer faster wins
  const legal = legalColumns(cells);
  if (legal.length === 0) return 0;
  if (depth === 0) return evaluate(cells, player);
  let best = -Infinity;
  for (const c of [3, 2, 4, 1, 5, 0, 6].filter((x) => legal.includes(x))) {
    const v = -negamax(drop(cells, c, player).cells, opp, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move for `player` searching `depth` plies (depth 1 = look at own move only). */
export function minimaxMove(cells: Cells, player: Player, depth: number, rng: Rng): number {
  const opp = (3 - player) as Player;
  const legal = legalColumns(cells);
  let best = -Infinity;
  let bestCols: number[] = [];
  for (const c of legal) {
    const v = -negamax(drop(cells, c, player).cells, opp, depth - 1, -Infinity, Infinity);
    if (v > best) {
      best = v;
      bestCols = [c];
    } else if (v === best) bestCols.push(c);
  }
  return bestCols[rng.nextU32() % bestCols.length];
}
