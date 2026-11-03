"use client";

import { useEffect } from "react";
import { FLY_LANGS, useFlyLang, useT, type FlyLang } from "@/features/fly-connect4/ui/i18n";

/** FR / EN / ES switch: remembered in this browser, otherwise taken from the browser's language. */
export function LangSwitch() {
  const { lang, setLang } = useFlyLang();
  const docTitle = useT().page.docTitle;

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("lang");
    } catch {}
    const guess = saved ?? navigator.language.slice(0, 2);
    if ((FLY_LANGS as string[]).includes(guess)) setLang(guess as FlyLang);
  }, [setLang]);

  useEffect(() => {
    document.title = docTitle;
    document.documentElement.lang = lang;
  }, [docTitle, lang]);

  const choose = (l: FlyLang) => {
    setLang(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 12 }}>
      {FLY_LANGS.map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: lang === l ? "var(--accent)" : "var(--bg-card)",
            color: lang === l ? "#fff" : "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
