/// <reference lib="webworker" />
// Web Worker hosting the simulation, so the page never blocks.
// Created with: new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" })

import { DEFAULT_DECISION, decide, type DecisionContext } from "../motor/decide";
import { inputColumns, parseColumns, type ColumnsFile } from "../vision/columns";
import { parseNetwork, parseNeurons, topEdges, type BrainMeta } from "./network";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import { SimSession } from "./session";

declare const self: DedicatedWorkerGlobalScope;

let session: SimSession | null = null;
let ctx: DecisionContext | null = null;

function reply(msg: WorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

/** Fetch with progress reports; total = uncompressed size from meta.json (gzip hides Content-Length). */
async function fetchWithProgress(url: string, total: number, onProgress: (loaded: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const out = new Uint8Array(total);
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (loaded + value.length > total) throw new Error(`${url}: larger than announced`);
    out.set(value, loaded);
    loaded += value.length;
    onProgress(loaded);
  }
  if (loaded !== total) throw new Error(`${url}: truncated (${loaded}/${total})`);
  return out.buffer;
}

async function load(baseUrl: string, seed: number, id: number) {
  const get = (f: string) => fetch(`${baseUrl}/${f}`);
  const meta = (await get("meta.json").then((r) => r.json())) as BrainMeta;
  const total = meta.files["network.bin"].bytes;
  let last = 0;
  const [netBuf, neuBuf, cols] = await Promise.all([
    fetchWithProgress(`${baseUrl}/network.bin`, total, (loaded) => {
      if (loaded - last > total / 100 || loaded === total) {
        last = loaded;
        reply({ id, type: "progress", loaded, total });
      }
    }),
    get("neurons.bin").then((r) => r.arrayBuffer()),
    get("columns.json").then((r) => r.json() as Promise<ColumnsFile>),
  ]);
  const net = parseNetwork(meta, netBuf);
  const neurons = parseNeurons(meta, neuBuf);
  const columns = parseColumns(cols);
  const o = meta.outputs;
  ctx = {
    net,
    columns,
    inputs: inputColumns(meta, neurons, columns),
    outputs: { DNa02_L: o.DNa02_L, DNa02_R: o.DNa02_R, DNa01_L: o.DNa01_L, DNa01_R: o.DNa01_R },
  };
  session = new SimSession(net, seed);
  return meta;
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      const meta = await load(m.baseUrl, m.seed, m.id);
      reply({ id: m.id, type: "ready", neurons: meta.counts.neurons, connections: meta.counts.connections, step: 0 });
      return;
    }
    if (!session || !ctx) throw new Error("worker not initialised");
    switch (m.type) {
      case "reset":
        session.reset(m.seed, m.silenced);
        break;
      case "setInputs":
        session.setInputs(m.targets, m.ratesHz);
        break;
      case "setRates":
        session.setRates(m.ratesHz);
        break;
      case "run": {
        const c = session.run(m.steps);
        reply({ id: m.id, type: "spikes", ...c }, [c.steps.buffer, c.neurons.buffer]);
        return;
      }
      case "topEdges": {
        const { targets, weights } = topEdges(ctx.net, m.k);
        reply({ id: m.id, type: "topEdges", k: m.k, targets, weights }, [targets.buffer, weights.buffer]);
        return;
      }
      case "decide": {
        const gen = decide(ctx, m.cells, m.seed, { ...DEFAULT_DECISION, ...m.params }, m.silenced ?? []);
        for (let r = gen.next(); ; r = gen.next()) {
          if (r.done) {
            reply({ id: m.id, type: "decision", decision: r.value });
            return;
          }
          const w = r.value;
          reply({ id: m.id, type: "window", window: w }, [w.steps.buffer, w.neurons.buffer]);
        }
      }
    }
    reply({ id: m.id, type: "ok", step: session.step });
  } catch (e) {
    reply({ id: m.id, type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
