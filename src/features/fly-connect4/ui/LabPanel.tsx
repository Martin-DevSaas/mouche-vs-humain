"use client";

import { LAB_PRESETS, useLab } from "../game/lab";
import { useGame } from "../game/store";
import styles from "./fly.module.css";

/** Mode labo: silence part of the brain before the fly's next move (Shiu et al. 2024). */
export function LabPanel() {
  const presetId = useLab((s) => s.presetId);
  const setPreset = useLab((s) => s.setPreset);
  const thinking = useGame((s) => s.status === "fly");
  return (
    <section className={styles.panel}>
      <h2>Expérience : éteindre une partie de son cerveau</h2>
      <label className={styles.field}>
        Partie à éteindre
        <select value={presetId} onChange={(e) => setPreset(e.target.value)} disabled={thinking}>
          {LAB_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        C&apos;est ce que font les chercheurs pour comprendre à quoi sert un neurone. Essayez d&apos;éteindre les
        neurones du virage : Simone ne tourne presque plus et joue toujours la colonne qu&apos;elle a en face
        d&apos;elle.
      </p>
    </section>
  );
}
