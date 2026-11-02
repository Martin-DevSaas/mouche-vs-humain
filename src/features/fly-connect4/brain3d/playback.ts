// Playback of the decision being computed: the brain map follows the simulation live and
// stays on its last state once the move is played (no replay).
// The playhead (simulation steps, 0.1 ms) is mutable state read every frame; React only
// subscribes to the coarse state (mode, selection).

import { create } from "zustand";
import { brainRecorder } from "./recorder";

const STEPS_PER_S = 10000;

export type Mode = "idle" | "live";

export const playhead = { step: 0 };

interface BrainUi {
  mode: Mode;
  hoveredRegion: string | null;
  selectedNeuron: number | null;
  startLive(): void;
  setHoveredRegion(r: string | null): void;
  selectNeuron(i: number | null): void;
}

export const useBrainUi = create<BrainUi>((set) => ({
  mode: "idle",
  hoveredRegion: null,
  selectedNeuron: null,
  startLive() {
    brainRecorder.reset();
    playhead.step = 0;
    set({ mode: "live" });
  },
  setHoveredRegion(r) {
    set({ hoveredRegion: r });
  },
  selectNeuron(i) {
    set({ selectedNeuron: i });
  },
}));

/** Advance the playhead by dtReal seconds; returns the new step. */
export function advancePlayhead(dtReal: number): number {
  const { mode } = useBrainUi.getState();
  const end = brainRecorder.endStep;
  if (mode === "live") {
    // chase the newest simulated step smoothly (the simulation runs slower than real time)
    const gap = end - playhead.step;
    playhead.step = Math.min(end, playhead.step + Math.max(gap * 3 * dtReal, STEPS_PER_S * 0.25 * dtReal));
  }
  return playhead.step;
}
