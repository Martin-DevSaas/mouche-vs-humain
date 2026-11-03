"use client";

// Static panels below the game: plain explanations, tutorial and credits.

import { DATA_CREDITS, REFERENCES } from "./references";
import { useT } from "./i18n";
import styles from "./fly.module.css";

const text: React.CSSProperties = { color: "var(--text-secondary)", lineHeight: 1.65, margin: "6px 0 0", fontSize: 15 };
const h2: React.CSSProperties = { fontSize: 15, color: "var(--text-primary)", margin: 0 };

/** Title and sentence above the game. */
export function Header() {
  const t = useT();
  return (
    <>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>{t.page.title}</h1>
      <p style={{ ...text, maxWidth: 760, margin: "0 0 20px" }}>{t.page.intro}</p>
    </>
  );
}

/** "Comment Simone choisit sa colonne", "D'où vient son cerveau ?", "Est-ce qu'elle joue bien ?". */
export function Explainer() {
  const t = useT();
  return (
    <section className={styles.wide} style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 36 }}>
      <div>
        <h2 style={h2}>{t.page.howTitle}</h2>
        <ol style={{ ...text, paddingLeft: 22 }}>
          {t.page.how.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <p style={text}>{t.page.howNote}</p>
      </div>
      <div>
        <h2 style={h2}>{t.page.brainTitle}</h2>
        <p style={text}>{t.page.brain}</p>
      </div>
      <div>
        <h2 style={h2}>{t.page.levelTitle}</h2>
        <p style={text}>{t.page.level}</p>
      </div>
    </section>
  );
}

/** "Le refaire chez vous": install and run the game locally, step by step. */
export function Tutorial() {
  const t = useT().tuto;
  return (
    <details className={styles.panel}>
      <summary>{t.summary}</summary>
      <p>{t.intro}</p>

      <h3>{t.beforeTitle}</h3>
      <ul>
        {t.before.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>

      <h3>{t.stepsTitle}</h3>
      <ol className={styles.steps}>
        <li>
          {t.download}
          <br />
          <span className={styles.note}>{t.git}</span>
        </li>
        <li>
          {t.install}
          <pre className={styles.cmd}>npm install</pre>
        </li>
        <li>
          {t.run}
          <pre className={styles.cmd}>npm run dev</pre>
        </li>
        <li>{t.play}</li>
      </ol>

      <h3>{t.moreTitle}</h3>
      <ul>
        {t.more.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </details>
  );
}

export function Credits() {
  const t = useT().credits;
  return (
    <details className={styles.panel}>
      <summary>{t.summary}</summary>
      <h3>{t.dataTitle}</h3>
      <ul>
        {DATA_CREDITS.map((c) => (
          <li key={c.url}>
            <strong>{t.what[c.id]}</strong> — {c.who.endsWith(".") ? c.who : `${c.who}.`} {c.ref}. {t.license}{" "}
            {c.license}.{" "}
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              {c.url.replace("https://", "")}
            </a>
          </li>
        ))}
        <li>{t.flywire}</li>
      </ul>
      <h3>{t.papers}</h3>
      <ul className={styles.refs}>
        {REFERENCES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className={styles.note}>{t.note}</p>
    </details>
  );
}
