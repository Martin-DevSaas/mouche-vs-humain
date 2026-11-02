import type { Metadata } from "next";
import { ClientEntry } from "./ClientEntry";
import { Credits, Tutorial } from "@/features/fly-connect4/ui/InfoPanels";
import styles from "@/features/fly-connect4/ui/fly.module.css";

const DESCRIPTION =
  "Jouez au Puissance 4 contre Simone, une drosophile simulée : chacun de ses coups vient uniquement de l'activité de ses neurones de virage, calculée à partir de son vrai connectome (MaleCNS).";

export const metadata: Metadata = {
  title: "Mouche vs Humain — Puissance 4 contre un cerveau de mouche simulé",
  description: DESCRIPTION,
};

const text: React.CSSProperties = { color: "var(--text-secondary)", lineHeight: 1.65, margin: "6px 0 0", fontSize: 15 };
const h2: React.CSSProperties = { fontSize: 15, color: "var(--text-primary)", margin: 0 };

export default function MouchePuissance4Page() {
  return (
    <main style={{ width: "92%", maxWidth: 1400, margin: "0 auto", padding: "40px 0 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Mouche vs Humain</h1>
      <p style={{ ...text, maxWidth: 760, margin: "0 0 20px" }}>
        Vous jouez les rouges. Simone, une mouche simulée par ordinateur, joue les jaunes. Personne ne lui a appris les
        règles : elle regarde le plateau, son cerveau réagit, et elle joue la colonne vers laquelle elle se tourne. À
        droite, vous voyez son cerveau s&apos;allumer pendant qu&apos;elle réfléchit.
      </p>

      <ClientEntry />

      <section className={styles.wide} style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 36 }}>
        <div>
          <h2 style={h2}>Comment Simone choisit sa colonne</h2>
          <ol style={{ ...text, paddingLeft: 22 }}>
            <li>
              <strong>Elle regarde le plateau.</strong>{" "}On calcule ce que voit chaque petite facette de ses yeux.
            </li>
            <li>
              <strong>Son cerveau réagit.</strong>{" "}L&apos;image passe de neurone en neurone, en suivant exactement les
              branchements du cerveau d&apos;une vraie mouche.
            </li>
            <li>
              <strong>Elle tourne, puis elle joue.</strong>{" "}Si ses neurones du virage s&apos;activent plus à gauche,
              elle tourne à gauche, et inversement. Quand elle s&apos;arrête, elle joue la colonne en face d&apos;elle.
            </li>
          </ol>
          <p style={text}>Aucune règle du Puissance 4 n&apos;est programmée : tout vient de son cerveau.</p>
        </div>
        <div>
          <h2 style={h2}>D&apos;où vient son cerveau ?</h2>
          <p style={text}>
            Des chercheurs ont découpé le cerveau d&apos;une vraie mouche en tranches ultra-fines, les ont photographiées
            au microscope, puis ont retracé chaque neurone et chaque branchement. Cette carte complète contient 166 700
            neurones. Simone en utilise environ 27 000 : ceux qui servent à voir et à tourner.
          </p>
        </div>
        <div>
          <h2 style={h2}>Est-ce qu&apos;elle joue bien ?</h2>
          <p style={text}>
            Non. Sur 1 200 parties de test, elle gagne aussi souvent qu&apos;un joueur qui joue au hasard, avec juste une
            petite préférence pour la gauche. C&apos;est normal : une mouche n&apos;a jamais appris le Puissance 4. Ce
            n&apos;est ni une vraie mouche, ni une intelligence artificielle entraînée à gagner, mais la simulation
            de son cerveau.
          </p>
        </div>
      </section>

      <div className={styles.wide} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 36 }}>
        <Tutorial />
        <Credits />
      </div>
    </main>
  );
}
