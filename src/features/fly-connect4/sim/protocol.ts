// Messages between the page and sim.worker.ts.

import type { Decision, DecisionParams, WindowRecord } from "../motor/decide";

export type WorkerRequest =
  | { id: number; type: "init"; baseUrl: string; seed: number }
  | { id: number; type: "reset"; seed: number; silenced: Int32Array }
  | { id: number; type: "setInputs"; targets: Int32Array; ratesHz: Float64Array }
  | { id: number; type: "setRates"; ratesHz: Float64Array }
  | { id: number; type: "run"; steps: number }
  | { id: number; type: "topEdges"; k: number }
  | {
      id: number;
      type: "decide";
      cells: Uint8Array;
      seed: number;
      params?: Partial<DecisionParams>;
      silenced?: Int32Array;
    };

export type WorkerResponse =
  | { id: number; type: "ready"; neurons: number; connections: number; step: number }
  | { id: number; type: "ok"; step: number }
  | { id: number; type: "spikes"; fromStep: number; toStep: number; steps: Int32Array; neurons: Int32Array }
  /** Streamed while a "decide" request runs (same id), one per simulated window. */
  | { id: number; type: "window"; window: WindowRecord }
  | { id: number; type: "decision"; decision: Decision }
  /** Streamed during "init": bytes of the connectome downloaded so far. */
  | { id: number; type: "progress"; loaded: number; total: number }
  /** k strongest outgoing connections per neuron (by |synapse count|), -1 = none. */
  | { id: number; type: "topEdges"; k: number; targets: Int32Array; weights: Int16Array }
  | { id: number; type: "error"; message: string };
