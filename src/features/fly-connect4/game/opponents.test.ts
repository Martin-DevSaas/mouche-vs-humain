import { describe, expect, it } from "vitest";
import { Rng } from "../sim/rng";
import { drop, emptyBoard, legalColumns, outcome, type Cells, type Player } from "./connect4";
import { minimaxMove, randomMove } from "./opponents";

function play(moves: number[], first: Player = 1): Cells {
  let cells = emptyBoard();
  let p = first;
  for (const c of moves) {
    cells = drop(cells, c, p).cells;
    p = (3 - p) as Player;
  }
  return cells;
}

describe("benchmark opponents", () => {
  it("random player only plays legal columns, all of them eventually", () => {
    const rng = new Rng(1);
    const cells = play([0, 0, 0, 0, 0, 0]);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const c = randomMove(cells, rng);
      expect(legalColumns(cells)).toContain(c);
      seen.add(c);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("minimax depth 1 takes an immediate win", () => {
    const cells = play([0, 6, 1, 6, 2, 5]); // red has 0,1,2 on the bottom row
    expect(minimaxMove(cells, 1, 1, new Rng(1))).toBe(3);
  });

  it("minimax depth 2+ blocks an immediate loss", () => {
    const cells = play([0, 6, 1, 6, 2]); // yellow to move, red threatens column 3
    for (const d of [2, 3, 5]) expect(minimaxMove(cells, 2, d, new Rng(d))).toBe(3);
  });

  it("deeper minimax beats a random player almost always", () => {
    let wins = 0;
    for (let g = 0; g < 20; g++) {
      const rng = new Rng(g);
      let cells = emptyBoard();
      let p: Player = g % 2 ? 1 : 2;
      while (outcome(cells).kind === "playing") {
        const c = p === 1 ? minimaxMove(cells, 1, 3, rng) : randomMove(cells, rng);
        cells = drop(cells, c, p).cells;
        p = (3 - p) as Player;
      }
      const o = outcome(cells);
      if (o.kind === "win" && o.player === 1) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
