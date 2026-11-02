"use client";

import { useEffect, useState } from "react";
import Brain3D, { dnReadout, type TopEdges } from "../brain3d/Brain3D";
import { cellRole } from "../brain3d/cellRoles";
import { SUPERCLASS_COLORS, type BrainData } from "../brain3d/data";
import { playhead, useBrainUi } from "../brain3d/playback";
import { useGame } from "../game/store";
import { brainRecorder } from "../brain3d/recorder";
import { regionInfo } from "../brain3d/regions";
import { SOURCES } from "../brain3d/sources";
import styles from "./fly.module.css";

const SUPERCLASS_FR: Record<string, string> = {
  ol_intrinsic: "lobe optique",
  visual_projection: "projection visuelle",
  visual_centrifugal: "centrifuge visuel",
  cb_intrinsic: "cerveau central",
  descending_neuron: "neurone descendant",
  ascending_neuron: "neurone ascendant",
  vnc_intrinsic: "corde nerveuse",
};
const NT_FR: Record<string, string> = {
  acetylcholine: "acétylcholine (excitateur)",
  gaba: "GABA (inhibiteur)",
  glutamate: "glutamate (inhibiteur dans le modèle)",
  histamine: "histamine (inhibiteur)",
  dopamine: "dopamine",
  serotonin: "sérotonine",
  octopamine: "octopamine",
};

/** Re-render at ~15 Hz while the map is catching up with the simulation (playhead, gauges). */
function useTicker(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    let shown = -1;
    const id = window.setInterval(() => {
      // nothing moves once the playhead has reached the end of the decision
      if (useGame.getState().status !== "fly" && playhead.step === shown) return;
      shown = playhead.step;
      setT((x) => x + 1);
    }, 66);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

function Gauge({ label, left, right, max }: { label: string; left: number; right: number; max: number }) {
  const l = Math.min(1, left / max);
  const r = Math.min(1, right / max);
  return (
    <div className={styles.gauge}>
      <span className={styles.gaugeLabel}>{label}</span>
      <div className={styles.gaugeBar}>
        <div className={styles.gaugeHalf} style={{ justifyContent: "flex-end" }}>
          <div className={styles.gaugeFill} style={{ width: `${l * 100}%` }} />
        </div>
        <div className={styles.gaugeHalf}>
          <div className={styles.gaugeFill} style={{ width: `${r * 100}%` }} />
        </div>
      </div>
      <span className={styles.gaugeValues}>
        G {left.toFixed(0)} · D {right.toFixed(0)} Hz
      </span>
    </div>
  );
}

export function BrainPanel({
  data,
  edges,
  glbUrl,
  light,
  reducedMotion,
}: {
  data: BrainData;
  edges: TopEdges | null;
  glbUrl: string;
  light: boolean;
  reducedMotion: boolean;
}) {
  useTicker();
  const ui = useBrainUi();
  const r = dnReadout.rates;
  const end = brainRecorder.endStep;
  const thinking = useGame((st) => st.status === "fly");
  const region = ui.hoveredRegion ? regionInfo(ui.hoveredRegion) : null;
  const sel = ui.selectedNeuron;
  const selType = sel !== null ? data.meta.types[data.neurons.type[sel]] : null;
  const selRole = selType ? cellRole(selType) : null;

  return (
    <div className={styles.brain}>
      <div className={styles.brainCanvas}>
        <Brain3D data={data} edges={edges} glbUrl={glbUrl} light={light} reducedMotion={reducedMotion} />
        {region && (
          <div className={styles.tooltip}>
            <strong>
              {region.name}
              {region.side ? ` (${region.side})` : ""}
            </strong>
            <span>{region.role ?? "Rôle inconnu."}</span>
            {region.source && <small>{SOURCES[region.source]}</small>}
          </div>
        )}
        {sel !== null && selType && (
          <div className={styles.card}>
            <button className={styles.close} onClick={() => ui.selectNeuron(null)} aria-label="Fermer">
              ×
            </button>
            <strong>{selType}</strong>
            <span>
              {SUPERCLASS_FR[data.meta.superclasses[data.neurons.superclass[sel]]] ??
                data.meta.superclasses[data.neurons.superclass[sel]]}
              {" · côté "}
              {data.meta.sides[data.neurons.side[sel]] === "L"
                ? "gauche"
                : data.meta.sides[data.neurons.side[sel]] === "R"
                  ? "droit"
                  : "médian"}
            </span>
            <span>
              Neurotransmetteur : {NT_FR[data.meta.nts[data.neurons.nt[sel]]] ?? data.meta.nts[data.neurons.nt[sel]]}
            </span>
            <span>Région principale : {regionInfo(data.meta.rois[data.neurons.roi[sel]].name).name}</span>
            <span>{selRole?.role ?? "Rôle inconnu."}</span>
            {selRole?.source && <small>{SOURCES[selRole.source]}</small>}
            <small>MaleCNS v1.0, bodyId {data.neurons.bodyId[sel]}</small>
          </div>
        )}
        <div className={styles.orient}>Vue de face · la droite de Simone est à gauche de l&apos;écran</div>
      </div>

      <div className={styles.gauges}>
        <Gauge label="DNa02" left={r.DNa02_L} right={r.DNa02_R} max={60} />
        <Gauge label="DNa01" left={r.DNa01_L} right={r.DNa01_R} max={60} />
      </div>

      <div className={styles.time}>
        {ui.mode === "idle"
          ? "En attente du premier coup de Simone"
          : thinking
            ? `Calcul en direct : ${(playhead.step / 10000).toFixed(2)} s simulées`
            : `Fin du calcul : ${(end / 10000).toFixed(2)} s simulées. La carte garde le dernier état jusqu'au prochain coup.`}
      </div>

      <div className={styles.legend}>
        {Object.entries(SUPERCLASS_FR).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: SUPERCLASS_COLORS[k] }} />
            {v}
          </span>
        ))}
        <span>
          <i className={styles.colormap} /> activité des neuropiles
        </span>
      </div>
    </div>
  );
}
