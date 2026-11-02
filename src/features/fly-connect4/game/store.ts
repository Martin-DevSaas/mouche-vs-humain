// Game state (zustand). Logic only: animations read `pieces[].droppedAt` and `clearingSince`.

import { create } from "zustand";
import type { Decision, WindowRecord } from "../motor/decide";
import { drop, emptyBoard, outcome, type Cells, type Outcome, type Player } from "./connect4";

export const HUMAN: Player = 1; // red
export const FLY: Player = 2; // yellow

export type Status = "loading" | "human" | "fly" | "over" | "clearing";

export interface PlacedPiece {
  id: number;
  col: number;
  row: number;
  player: Player;
  /** performance.now() when released above the board. */
  droppedAt: number;
}

export interface FlyMove {
  moveIndex: number;
  seed: number;
  decision: Decision;
  /** Per-window summary (heading, DN spike counts); spikes are kept by the brain view. */
  windows: Pick<WindowRecord, "index" | "headingDeg" | "dn" | "omegaDegS">[];
  /** Lab mode: what was silenced during this move, if anything. */
  silencedLabel: string | null;
}

interface GameState {
  cells: Cells;
  pieces: PlacedPiece[];
  turn: Player;
  firstPlayer: Player;
  outcome: Outcome;
  status: Status;
  gameSeed: number;
  /** Heading of the fly while it thinks (deg), null otherwise. */
  flyHeadingDeg: number | null;
  flySimulatedMs: number;
  flyMoves: FlyMove[];
  lastFallback: { from: number; to: number } | null;
  hoverCol: number | null;
  clearingSince: number | null;
  score: { human: number; fly: number; draw: number };

  ready(): void;
  newGame(firstPlayer?: Player, seed?: number): void;
  setHover(col: number | null): void;
  humanPlay(col: number): void;
  flyWindow(w: WindowRecord): void;
  flyPlay(decision: Decision, windows: FlyMove["windows"], silencedLabel?: string | null): void;
  clearBoard(): void;
  clearFinished(): void;
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}

/** Seed of the fly's n-th move in a game (splitmix32 of the pair). */
export function moveSeed(gameSeed: number, moveIndex: number): number {
  let z = (gameSeed ^ Math.imul(moveIndex + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

let nextPieceId = 1;

export const useGame = create<GameState>((set, get) => {
  function place(col: number, player: Player) {
    const { cells, pieces } = get();
    const { cells: next, row } = drop(cells, col, player);
    const o = outcome(next);
    const turn = (3 - player) as Player;
    const s = get().score;
    set({
      cells: next,
      pieces: [...pieces, { id: nextPieceId++, col, row, player, droppedAt: performance.now() }],
      outcome: o,
      turn,
      status: o.kind === "playing" ? (turn === HUMAN ? "human" : "fly") : "over",
      hoverCol: null,
      score:
        o.kind === "win"
          ? { ...s, [o.player === HUMAN ? "human" : "fly"]: s[o.player === HUMAN ? "human" : "fly"] + 1 }
          : o.kind === "draw"
            ? { ...s, draw: s.draw + 1 }
            : s,
    });
  }

  return {
    cells: emptyBoard(),
    pieces: [],
    turn: HUMAN,
    firstPlayer: HUMAN,
    outcome: { kind: "playing" },
    status: "loading",
    gameSeed: 0,
    flyHeadingDeg: null,
    flySimulatedMs: 0,
    flyMoves: [],
    lastFallback: null,
    hoverCol: null,
    clearingSince: null,
    score: { human: 0, fly: 0, draw: 0 },

    ready() {
      get().newGame(get().firstPlayer);
    },

    newGame(firstPlayer = get().firstPlayer, seed = randomSeed()) {
      set({
        cells: emptyBoard(),
        pieces: [],
        turn: firstPlayer,
        firstPlayer,
        outcome: { kind: "playing" },
        status: firstPlayer === HUMAN ? "human" : "fly",
        gameSeed: seed,
        flyHeadingDeg: null,
        flySimulatedMs: 0,
        flyMoves: [],
        lastFallback: null,
        hoverCol: null,
        clearingSince: null,
      });
    },

    setHover(col) {
      if (get().status === "human" || col === null) set({ hoverCol: col });
    },

    humanPlay(col) {
      if (get().status !== "human") return;
      try {
        place(col, HUMAN);
      } catch {
        // full column: ignore the click
      }
    },

    flyWindow(w) {
      set({ flyHeadingDeg: w.headingDeg, flySimulatedMs: (w.toStep * 0.1) | 0 });
    },

    flyPlay(decision, windows, silencedLabel = null) {
      if (get().status !== "fly") return;
      const moveIndex = get().flyMoves.length;
      set({
        flyMoves: [...get().flyMoves, { moveIndex, seed: decision.seed, decision, windows, silencedLabel }],
        lastFallback: decision.fallback,
        flyHeadingDeg: null,
      });
      place(decision.playedColumn, FLY);
    },

    clearBoard() {
      if (get().pieces.length === 0) return get().newGame();
      set({ status: "clearing", clearingSince: performance.now(), hoverCol: null, flyHeadingDeg: null });
    },

    clearFinished() {
      get().newGame();
    },
  };
});
