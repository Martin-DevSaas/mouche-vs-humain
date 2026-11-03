"use client";

import { useGame } from "../game/store";
import { useT } from "./i18n";
import styles from "./fly.module.css";

/** "Pourquoi elle a joué ici": the last move in plain words. */
export function WhyPanel() {
  const t = useT();
  const status = useGame((s) => s.status);
  const move = useGame((s) => s.flyMoves[s.flyMoves.length - 1]);

  if (status === "fly")
    return (
      <section className={styles.panel}>
        <h2>{t.why.title}</h2>
        <p>{t.why.thinking}</p>
      </section>
    );
  if (!move) {
    return (
      <section className={styles.panel}>
        <h2>{t.why.title}</h2>
        <p>{t.why.empty}</p>
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
      <h2>{t.why.title}</h2>
      <p>
        {Math.abs(turned) >= 0.5 ? t.why.turned(turned > 0, d.playedColumn + 1) : t.why.straight(d.playedColumn + 1)}
      </p>
      <p>
        {t.why.rule} {dn.left + dn.right === 0 ? t.why.noSignal : t.why.signals(dn.left, dn.right)}
      </p>
      {move.silenced && <p>{t.why.silenced(t.lab.presets[move.silenced] ?? move.silenced)}</p>}
      {d.fallback && <p>{t.why.fallback(d.fallback.from + 1)}</p>}
    </section>
  );
}
