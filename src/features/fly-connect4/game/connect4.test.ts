import { describe, expect, it } from "vitest";
import { COLS, ROWS, drop, emptyBoard, isColumnFull, legalColumns, outcome, winningLine, type Cells, type Player } from "./connect4";

function play(moves: number[], first: Player = 1): Cells {
  let cells = emptyBoard();
  let p = first;
  for (const c of moves) {
    cells = drop(cells, c, p).cells;
    p = (3 - p) as Player;
  }
  return cells;
}

describe("connect four rules", () => {
  it("drops pieces with gravity and rejects full or invalid columns", () => {
    let cells = emptyBoard();
    for (let i = 0; i < ROWS; i++) {
      const r = drop(cells, 3, 1);
      expect(r.row).toBe(i);
      cells = r.cells;
    }
    expect(isColumnFull(cells, 3)).toBe(true);
    expect(legalColumns(cells)).toEqual([0, 1, 2, 4, 5, 6]);
    expect(() => drop(cells, 3, 2)).toThrow();
    expect(() => drop(cells, 7, 2)).toThrow();
    expect(() => drop(cells, -1, 2)).toThrow();
  });

  it("does not mutate the input board", () => {
    const a = emptyBoard();
    drop(a, 0, 1);
    expect(a.every((x) => x === 0)).toBe(true);
  });

  it("detects horizontal, vertical and both diagonal wins", () => {
    expect(winningLine(play([0, 0, 1, 1, 2, 2, 3]), 1)).toEqual([0, 1, 2, 3]);
    expect(winningLine(play([4, 5, 4, 5, 4, 5, 4]), 1)).toEqual([4, 11, 18, 25]);
    // diagonal /
    const diag = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(outcome(diag)).toEqual({ kind: "win", player: 1, line: [0, 8, 16, 24] });
    // diagonal \ (mirror)
    const anti = play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    expect(outcome(anti)).toEqual({ kind: "win", player: 1, line: [3 * COLS + 3, 2 * COLS + 4, COLS + 5, 6] });
  });

  it("does not report three in a row", () => {
    expect(outcome(play([0, 0, 1, 1, 2]))).toEqual({ kind: "playing" });
  });

  it("detects a draw on a full board without four in a row", () => {
    // Column order chosen so that no player aligns four.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const cells = play(order);
    expect(legalColumns(cells)).toEqual([]);
    expect(outcome(cells)).toEqual({ kind: "draw" });
  });

  it("lets the fly (yellow) start", () => {
    const cells = play([3], 2);
    expect(cells[3]).toBe(2);
  });
});
