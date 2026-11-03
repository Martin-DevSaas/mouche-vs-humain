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
import { useT } from "./i18n";
import styles from "./fly.module.css";

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
  const t = useT().brain;
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
        {t.gauge.L} {left.toFixed(0)} · {t.gauge.R} {right.toFixed(0)} Hz
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
  const tt = useT();
  const t = tt.brain;
  const ui = useBrainUi();
  const r = dnReadout.rates;
  const end = brainRecorder.endStep;
  const thinking = useGame((st) => st.status === "fly");
  const region = ui.hoveredRegion ? regionInfo(ui.hoveredRegion, tt.lang) : null;
  const sel = ui.selectedNeuron;
  const selType = sel !== null ? data.meta.types[data.neurons.type[sel]] : null;
  const selRole = selType ? cellRole(selType, tt.lang) : null;

  return (
    <div className={styles.brain}>
      <div className={styles.brainCanvas}>
        <Brain3D
          data={data}
          edges={edges}
          glbUrl={glbUrl}
          light={light}
          reducedMotion={reducedMotion}
          label={t.mapLabel}
        />
        {region && (
          <div className={styles.tooltip}>
            <strong>
              {region.name}
              {region.side ? ` (${region.side})` : ""}
            </strong>
            <span>{region.role ?? t.unknownRole}</span>
            {region.source && <small>{SOURCES[region.source]}</small>}
          </div>
        )}
        {sel !== null && selType && (
          <div className={styles.card}>
            <button className={styles.close} onClick={() => ui.selectNeuron(null)} aria-label={t.close}>
              ×
            </button>
            <strong>{selType}</strong>
            <span>
              {t.superclass[data.meta.superclasses[data.neurons.superclass[sel]]] ??
                data.meta.superclasses[data.neurons.superclass[sel]]}
              {t.side(
                data.meta.sides[data.neurons.side[sel]] === "L"
                  ? t.sides.L
                  : data.meta.sides[data.neurons.side[sel]] === "R"
                    ? t.sides.R
                    : t.sides.M,
              )}
            </span>
            <span>
              {t.transmitter} {t.nt[data.meta.nts[data.neurons.nt[sel]]] ?? data.meta.nts[data.neurons.nt[sel]]}
            </span>
            <span>
              {t.mainRegion} {regionInfo(data.meta.rois[data.neurons.roi[sel]].name, tt.lang).name}
            </span>
            <span>{selRole?.role ?? t.unknownRole}</span>
            {selRole?.source && <small>{SOURCES[selRole.source]}</small>}
            <small>MaleCNS v1.0, bodyId {data.neurons.bodyId[sel]}</small>
          </div>
        )}
        <div className={styles.orient}>{t.orient}</div>
      </div>

      <div className={styles.gauges}>
        <Gauge label="DNa02" left={r.DNa02_L} right={r.DNa02_R} max={60} />
        <Gauge label="DNa01" left={r.DNa01_L} right={r.DNa01_R} max={60} />
      </div>

      <div className={styles.time}>
        {ui.mode === "idle"
          ? t.idle
          : thinking
            ? t.live(playhead.step / 10000)
            : t.done(end / 10000)}
      </div>

      <div className={styles.legend}>
        {Object.entries(t.superclass).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: SUPERCLASS_COLORS[k] }} />
            {v}
          </span>
        ))}
        <span>
          <i className={styles.colormap} /> {t.neuropilActivity}
        </span>
      </div>
    </div>
  );
}
