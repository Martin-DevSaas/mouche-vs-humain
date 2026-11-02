import { beforeEach, describe, expect, it } from "vitest";
import type { Decision } from "../motor/decide";
import { FLY, HUMAN, moveSeed, useGame } from "./store";

const decision = (col: number, fallback: Decision["fallback"] = null): Decision => ({
  seed: 1,
  initialHeadingDeg: 0,
  finalHeadingDeg: 0,
  aimedColumn: fallback ? fallback.from : col,
  playedColumn: col,
  fallback,
  simulatedMs: 1000,
  stoppedBecause: "stable",
});

describe("game store", () => {
  beforeEach(() => useGame.getState().newGame(HUMAN, 42));

  it("alternates human and fly turns", () => {
    const g = useGame.getState;
    expect(g().status).toBe("human");
    g().flyPlay(decision(0), []); // not the fly's turn: ignored
    expect(g().pieces).toHaveLength(0);
    g().humanPlay(3);
    expect(g().status).toBe("fly");
    g().humanPlay(3); // not the human's turn: ignored
    expect(g().pieces).toHaveLength(1);
    g().flyPlay(decision(4), []);
    expect(g().status).toBe("human");
    expect(g().pieces.map((p) => [p.col, p.row, p.player])).toEqual([[3, 0, HUMAN], [4, 0, FLY]]);
    expect(g().flyMoves).toHaveLength(1);
  });

  it("ends the game on four in a row and counts the score", () => {
    const g = useGame.getState;
    const before = g().score.human;
    for (const c of [0, 1, 2]) {
      g().humanPlay(c);
      g().flyPlay(decision(c), []);
    }
    g().humanPlay(3);
    expect(g().outcome.kind).toBe("win");
    expect(g().status).toBe("over");
    expect(g().score.human).toBe(before + 1);
  });

  it("records the full-column fallback", () => {
    const g = useGame.getState;
    g().humanPlay(0);
    g().flyPlay(decision(1, { from: 0, to: 1 }), []);
    expect(g().lastFallback).toEqual({ from: 0, to: 1 });
  });

  it("lets the fly start and derives replayable move seeds", () => {
    useGame.getState().newGame(FLY, 7);
    expect(useGame.getState().status).toBe("fly");
    expect(moveSeed(7, 0)).toBe(moveSeed(7, 0));
    expect(moveSeed(7, 0)).not.toBe(moveSeed(7, 1));
    expect(moveSeed(7, 0)).not.toBe(moveSeed(8, 0));
  });
});
