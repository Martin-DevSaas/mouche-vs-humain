"use client";

import { useEffect, useRef, useState } from "react";
import Board3D from "../board3d/Board3D";
import { setMuted, unlockAudio } from "../board3d/sound";
import { FLY, HUMAN, moveSeed, useGame, type FlyMove } from "../game/store";
import { SimClient } from "../sim/client";
import type { TopEdges } from "../brain3d/Brain3D";
import { loadBrainData, type BrainData } from "../brain3d/data";
import { useBrainUi } from "../brain3d/playback";
import { brainRecorder } from "../brain3d/recorder";
import { BrainPanel } from "./BrainPanel";
import { LabPanel } from "./LabPanel";
import { VisionPanel } from "./VisionPanel";
import { WhyPanel } from "./WhyPanel";
import { LAB_PRESETS, presetNeurons, useLab } from "../game/lab";
import { parseColumns, type ColumnsFile } from "../vision/columns";
import type { Column } from "../vision/eye";
import styles from "./fly.module.css";

const ASSETS = "/fly-brain/v1";
const DROP_SETTLE_MS = 700; // let the previous piece land before the fly starts thinking

function useFlyController(client: SimClient | null, data: BrainData | null) {
  const status = useGame((s) => s.status);
  const busy = useRef(false);

  useEffect(() => {
    if (!client || !data || status !== "fly" || busy.current) return;
    busy.current = true;
    const preset = LAB_PRESETS.find((p) => p.id === useLab.getState().presetId) ?? LAB_PRESETS[0];
    const silenced = presetNeurons(preset, data.meta, data.neurons);
    const silencedLabel = silenced.length ? preset.label : null;
    const { cells, gameSeed, flyMoves, pieces } = useGame.getState();
    const seed = moveSeed(gameSeed, flyMoves.length);
    const last = pieces[pieces.length - 1];
    const wait = last ? Math.max(0, last.droppedAt + DROP_SETTLE_MS - performance.now()) : 0;
    const windows: FlyMove["windows"] = [];
    const timer = setTimeout(() => {
      useBrainUi.getState().startLive();
      client
        .decide(
          cells,
          seed,
          (w) => {
            windows.push({ index: w.index, headingDeg: w.headingDeg, dn: w.dn, omegaDegS: w.omegaDegS });
            if (useGame.getState().gameSeed !== gameSeed) return;
            // the brain map shows exactly these spikes, live
            brainRecorder.append(w.steps, w.neurons, w.toStep);
            useGame.getState().flyWindow(w);
          },
          undefined,
          silenced,
        )
        .then((d) => {
          if (useGame.getState().gameSeed !== gameSeed) return;
          useGame.getState().flyPlay(d, windows, silencedLabel);
        })
        .catch((e) => console.error(e))
        .finally(() => {
          busy.current = false;
        });
    }, wait);
    return () => clearTimeout(timer);
  }, [client, data, status]);
}

const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 14,
  cursor: "pointer",
};

function useDisplayMode() {
  const [mode, setMode] = useState({ light: false, reducedMotion: false });
  useEffect(() => {
    const light = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMode({ light: light.matches, reducedMotion: reduced.matches });
    update();
    light.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      light.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);
  return mode;
}

export default function Game() {
  const [client, setClient] = useState<SimClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [brain, setBrain] = useState<{ data: BrainData; edges: TopEdges; columns: Column[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const display = useDisplayMode();
  const s = useGame();

  useEffect(() => {
    // Debug aid for automated UI checks: /?debug=1 exposes the store.
    if (new URLSearchParams(window.location.search).has("debug")) {
      Object.assign(window as object, { __flyGame: useGame, __flyBrain: useBrainUi });
    }
    const c = new SimClient();
    let alive = true;
    c.init(ASSETS, 1, (loaded, total) => alive && setProgress(loaded / total))
      .then(async () => {
        if (!alive) return;
        const [data, edges, columns] = await Promise.all([
          loadBrainData(ASSETS),
          c.topEdges(3),
          fetch(`${ASSETS}/columns.json`)
            .then((r) => r.json() as Promise<ColumnsFile>)
            .then(parseColumns),
        ]);
        if (!alive) return;
        setBrain({ data, edges, columns });
        setClient(c);
        useGame.getState().ready();
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      alive = false;
      c.dispose();
    };
  }, []);

  useFlyController(client, brain?.data ?? null);

  const statusText =
    s.status === "loading"
      ? "Chargement du cerveau de Simone…"
      : s.status === "human"
        ? "À vous : cliquez sur une colonne (pions rouges)."
        : s.status === "fly"
          ? `Simone calcule son coup… ${(s.flySimulatedMs / 1000).toFixed(2)} s simulées`
          : s.status === "clearing"
            ? "On vide le plateau…"
            : s.outcome.kind === "win"
              ? s.outcome.player === HUMAN
                ? "Vous avez gagné !"
                : "Simone a gagné !"
              : "Match nul.";

  return (
    <div className={styles.layout}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={styles.panelBox} onPointerDown={() => unlockAudio()}>
          {error ? (
            <p style={{ padding: 24, color: "var(--text-secondary)" }}>Erreur de chargement : {error}</p>
          ) : (
            <Board3D />
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <strong style={{ color: "var(--text-primary)", marginRight: "auto" }} aria-live="polite">
            {statusText}
          </strong>
          <button style={btn} onClick={() => s.newGame()} disabled={s.status === "loading"}>
            Nouvelle partie
          </button>
          <button style={btn} onClick={() => s.clearBoard()} disabled={s.status === "loading" || s.status === "fly"}>
            Vider le plateau
          </button>
          <label
            style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text-secondary)", fontSize: 14 }}
          >
            <input
              type="checkbox"
              checked={s.firstPlayer === FLY}
              onChange={(e) => s.newGame(e.target.checked ? FLY : HUMAN)}
              disabled={s.status === "loading"}
            />
            Simone commence
          </label>
          <button
            style={btn}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            aria-pressed={muted}
          >
            {muted ? "Son coupé" : "Son"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 13,
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          <span>
            Score — vous {s.score.human} · Simone {s.score.fly} · nuls {s.score.draw}
          </span>
        </div>
      </div>
      {brain ? (
        <BrainPanel
          data={brain.data}
          edges={brain.edges}
          glbUrl={`${ASSETS}/neuropils.glb`}
          light={display.light}
          reducedMotion={display.reducedMotion}
        />
      ) : (
        <div
          className={styles.panelBox}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          {progress < 1 ? `Téléchargement du connectome… ${Math.round(progress * 100)} %` : "Préparation du cerveau…"}
          <div
            className={styles.progress}
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
      {brain && (
        <div className={`${styles.panels} ${styles.wide}`} style={{ gridColumn: "1 / -1" }}>
          <VisionPanel columns={brain.columns} />
          <WhyPanel />
          <LabPanel />
        </div>
      )}
    </div>
  );
}
