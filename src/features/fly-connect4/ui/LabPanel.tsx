"use client";

import { LAB_PRESETS, useLab } from "../game/lab";
import { useGame } from "../game/store";
import { useT } from "./i18n";
import styles from "./fly.module.css";

/** Mode labo: silence part of the brain before the fly's next move (Shiu et al. 2024). */
export function LabPanel() {
  const t = useT();
  const presetId = useLab((s) => s.presetId);
  const setPreset = useLab((s) => s.setPreset);
  const thinking = useGame((s) => s.status === "fly");
  return (
    <section className={styles.panel}>
      <h2>{t.lab.title}</h2>
      <label className={styles.field}>
        {t.lab.field}
        <select value={presetId} onChange={(e) => setPreset(e.target.value)} disabled={thinking}>
          {LAB_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t.lab.presets[p.id] ?? p.id}
            </option>
          ))}
        </select>
      </label>
      <p>{t.lab.text}</p>
    </section>
  );
}
