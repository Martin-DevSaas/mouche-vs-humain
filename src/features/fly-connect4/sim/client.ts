// Promise wrapper around sim.worker.ts for the page.

import type { Decision, DecisionParams, WindowRecord } from "../motor/decide";
import type { WorkerRequest, WorkerResponse } from "./protocol";

type Req = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;
type Res<T extends WorkerResponse["type"]> = Extract<WorkerResponse, { type: T }>;

interface Pending {
  resolve: (r: WorkerResponse) => void;
  reject: (e: Error) => void;
  onWindow?: (w: WindowRecord) => void;
  onProgress?: (loaded: number, total: number) => void;
}

export class SimClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      if (ev.data.type === "window") {
        p.onWindow?.(ev.data.window);
        return;
      }
      if (ev.data.type === "progress") {
        p.onProgress?.(ev.data.loaded, ev.data.total);
        return;
      }
      this.pending.delete(ev.data.id);
      if (ev.data.type === "error") p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    };
  }

  private call(
    req: Req,
    transfer: Transferable[] = [],
    callbacks: Pick<Pending, "onWindow" | "onProgress"> = {},
  ): Promise<WorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, ...callbacks });
      this.worker.postMessage({ ...req, id }, transfer);
    });
  }

  init(baseUrl: string, seed: number, onProgress?: (loaded: number, total: number) => void) {
    return this.call({ type: "init", baseUrl, seed }, [], { onProgress }) as Promise<Res<"ready">>;
  }

  reset(seed: number, silenced: Int32Array = new Int32Array(0)) {
    return this.call({ type: "reset", seed, silenced }) as Promise<Res<"ok">>;
  }

  setInputs(targets: Int32Array, ratesHz: Float64Array) {
    return this.call({ type: "setInputs", targets, ratesHz }) as Promise<Res<"ok">>;
  }

  setRates(ratesHz: Float64Array) {
    return this.call({ type: "setRates", ratesHz }) as Promise<Res<"ok">>;
  }

  run(steps: number) {
    return this.call({ type: "run", steps }) as Promise<Res<"spikes">>;
  }

  topEdges(k: number) {
    return this.call({ type: "topEdges", k }) as Promise<Res<"topEdges">>;
  }

  /** The fly's move; onWindow receives every 50 ms window (heading, DN counts, spikes) as it is simulated. */
  async decide(
    cells: Uint8Array,
    seed: number,
    onWindow: (w: WindowRecord) => void,
    params?: Partial<DecisionParams>,
    silenced?: Int32Array,
  ): Promise<Decision> {
    const r = (await this.call({ type: "decide", cells, seed, params, silenced }, [], { onWindow })) as Res<"decision">;
    return r.decision;
  }

  dispose(): void {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error("worker terminated"));
    this.pending.clear();
  }
}
