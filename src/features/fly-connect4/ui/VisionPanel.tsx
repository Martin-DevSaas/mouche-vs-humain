"use client";

import { useMemo, useState } from "react";
import { useGame } from "../game/store";
import { DEFAULT_DECISION } from "../motor/decide";
import { sampleOmmatidia, type Column, type Receptor } from "../vision/eye";
import { VisionMosaic } from "./VisionMosaic";
import { useT } from "./i18n";
import styles from "./fly.module.css";

const RECEPTORS = ["R1-6", "R8y", "R7y"] as const;

/** "Ce que voit la mouche": the ommatidia mosaic for the current board and heading. */
export function VisionPanel({ columns }: { columns: Column[] }) {
  const t = useT();
  const [receptor, setReceptor] = useState<Receptor>("R1-6");
  const cells = useGame((s) => s.cells);
  const thinking = useGame((s) => s.flyHeadingDeg);
  const lastMove = useGame((s) => s.flyMoves[s.flyMoves.length - 1]);
  const heading = thinking ?? lastMove?.decision.finalHeadingDeg ?? 0;
  // the mosaic is redrawn when the heading changes by more than half a degree
  const h = Math.round(heading * 2) / 2;
  const catches = useMemo(
    () => sampleOmmatidia(columns, cells, { distanceCm: DEFAULT_DECISION.distanceCm, headingDeg: h }),
    [columns, cells, h],
  );

  return (
    <section className={styles.panel}>
      <h2>{t.vision.title}</h2>
      <VisionMosaic columns={columns} catches={catches} receptor={receptor} label={t.vision.mosaicLabel(receptor)} />
      <div className={styles.tabs} role="radiogroup" aria-label={t.vision.choicesLabel}>
        {RECEPTORS.map((r) => (
          <button key={r} role="radio" aria-checked={receptor === r} onClick={() => setReceptor(r)}>
            {t.vision.choices[r]}
          </button>
        ))}
      </div>
      <p>{t.vision.p1(h.toLocaleString(t.lang === "en" ? "en-GB" : t.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))}</p>
      <p>{t.vision.p2}</p>
    </section>
  );
}
