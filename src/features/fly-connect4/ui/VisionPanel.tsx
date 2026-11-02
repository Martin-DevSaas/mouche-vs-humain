"use client";

import { useMemo, useState } from "react";
import { useGame } from "../game/store";
import { DEFAULT_DECISION } from "../motor/decide";
import { sampleOmmatidia, type Column, type Receptor } from "../vision/eye";
import { VisionMosaic } from "./VisionMosaic";
import styles from "./fly.module.css";

const CHOICES: { r: Receptor; label: string }[] = [
  { r: "R1-6", label: "R1–6 (utilisées par le modèle)" },
  { r: "R8y", label: "R8y (vert, et un peu de rouge)" },
  { r: "R7y", label: "R7y (ultraviolet)" },
];

/** "Ce que voit la mouche": the ommatidia mosaic for the current board and heading. */
export function VisionPanel({ columns }: { columns: Column[] }) {
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
      <h2>Ce que voit Simone</h2>
      <VisionMosaic columns={columns} catches={catches} receptor={receptor} />
      <div className={styles.tabs} role="radiogroup" aria-label="Type de photorécepteur">
        {CHOICES.map((c) => (
          <button key={c.r} role="radio" aria-checked={receptor === c.r} onClick={() => setReceptor(c.r)}>
            {c.label}
          </button>
        ))}
      </div>
      <p>
        L&apos;œil d&apos;une mouche est fait de petites facettes. Chacune reçoit la lumière d&apos;une seule direction.
        Simone en a 1 771 sur ses deux yeux. Chaque hexagone ci-dessus est une facette, et sa couleur indique la
        quantité de lumière qu&apos;elle reçoit quand Simone est orientée à {h.toFixed(1)}° (0° = face au centre du
        plateau).
      </p>
      <p>
        Les boutons changent le type de cellule de l&apos;œil affiché. La simulation n&apos;utilise que les cellules
        R1–6. Elles captent mal le rouge : pour elles, <strong>les pions rouges paraissent presque noirs</strong>. Les
        cellules R8y captent un peu le rouge et voient donc encore ces pions.
      </p>
    </section>
  );
}
