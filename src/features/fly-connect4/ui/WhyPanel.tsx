"use client";

import { useGame } from "../game/store";
import styles from "./fly.module.css";

/** "Pourquoi elle a joué ici": the last move in plain words. */
export function WhyPanel() {
  const status = useGame((s) => s.status);
  const move = useGame((s) => s.flyMoves[s.flyMoves.length - 1]);

  if (status === "fly")
    return (
      <section className={styles.panel}>
        <h2>Pourquoi Simone a joué ici</h2>
        <p>Simone réfléchit…</p>
      </section>
    );
  if (!move) {
    return (
      <section className={styles.panel}>
        <h2>Pourquoi Simone a joué ici</h2>
        <p>Après le premier coup de Simone, ce panneau explique en une phrase pourquoi elle a choisi cette colonne.</p>
      </section>
    );
  }
  const d = move.decision;
  const dn = move.windows.reduce(
    (a, w) => ({ left: a.left + w.dn.DNa02_L + w.dn.DNa01_L, right: a.right + w.dn.DNa02_R + w.dn.DNa01_R }),
    { left: 0, right: 0 },
  );
  const turned = d.finalHeadingDeg - d.initialHeadingDeg;

  return (
    <section className={styles.panel}>
      <h2>Pourquoi Simone a joué ici</h2>
      <p>
        {Math.abs(turned) >= 0.5 ? (
          <>
            Son cerveau l&apos;a fait tourner <strong>vers la {turned > 0 ? "droite" : "gauche"}</strong>, puis elle a
            joué la colonne qu&apos;elle avait en face d&apos;elle : la <strong>colonne {d.playedColumn + 1}</strong>.
          </>
        ) : (
          <>
            Son cerveau ne l&apos;a pas fait tourner : elle a joué la colonne qu&apos;elle avait déjà en face
            d&apos;elle, la <strong>colonne {d.playedColumn + 1}</strong>.
          </>
        )}
      </p>
      <p>
        Pour tourner, une mouche utilise quelques neurones du virage, à gauche et à droite : le côté qui envoie le plus
        de signaux l&apos;emporte.{" "}
        {dn.left + dn.right === 0 ? (
          "Pendant ce coup, aucun signal ne leur est parvenu."
        ) : (
          <>
            Pendant ce coup : <strong>{dn.left}</strong> signaux à gauche, <strong>{dn.right}</strong> à droite.
          </>
        )}
      </p>
      {move.silencedLabel && <p>Expérience en cours : « {move.silencedLabel} » était éteint pendant ce coup.</p>}
      {d.fallback && (
        <p>
          Elle visait la colonne {d.fallback.from + 1}, mais elle était pleine : elle a joué la colonne libre la plus
          proche.
        </p>
      )}
    </section>
  );
}
