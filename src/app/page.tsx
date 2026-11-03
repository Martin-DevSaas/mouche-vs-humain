import type { Metadata } from "next";
import { ClientEntry } from "./ClientEntry";
import { LangSwitch } from "./LangSwitch";
import { Credits, Explainer, Header, Tutorial } from "@/features/fly-connect4/ui/InfoPanels";
import styles from "@/features/fly-connect4/ui/fly.module.css";

export const metadata: Metadata = {
  title: "Mouche vs Humain — Puissance 4 contre un cerveau de mouche simulé",
  description:
    "Jouez au Puissance 4 contre Simone, une drosophile simulée : chacun de ses coups vient uniquement de l'activité de ses neurones de virage, calculée à partir de son vrai connectome (MaleCNS).",
};

export default function Page() {
  return (
    <main style={{ width: "92%", maxWidth: 1400, margin: "0 auto", padding: "24px 0 80px" }}>
      <LangSwitch />
      <Header />

      <ClientEntry />

      <Explainer />

      <div className={styles.wide} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 36 }}>
        <Tutorial />
        <Credits />
      </div>
    </main>
  );
}
