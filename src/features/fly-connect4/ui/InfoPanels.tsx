// Static panels below the game: tutorial and credits.

import { DATA_CREDITS, REFERENCES } from "./references";
import styles from "./fly.module.css";

export const REPO_URL = "https://github.com/Martin-DevSaas/mouche-vs-humain";

/** "Le refaire chez vous": install and run the game locally, step by step. */
export function Tutorial() {
  return (
    <details className={styles.panel}>
      <summary>Tuto : faire tourner Simone sur votre ordinateur</summary>
      <p>
        Environ 10 minutes, sans rien savoir coder. Ça marche sur Windows, Mac et Linux. Le cerveau de Simone est déjà
        inclus dans le projet : il n&apos;y a rien d&apos;autre à télécharger.
      </p>

      <h3>Avant de commencer</h3>
      <ul>
        <li>
          Installez <strong>Node.js</strong> : sur{" "}
          <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">
            nodejs.org
          </a>
          , cliquez sur le bouton « LTS », puis suivez l&apos;installation.
        </li>
        <li>
          Ouvrez un <strong>terminal</strong>{" "}: sur Windows, cherchez « Terminal » dans le menu Démarrer ; sur Mac,
          cherchez « Terminal » avec Spotlight (Cmd + Espace).
        </li>
      </ul>

      <h3>Les 4 étapes</h3>
      <ol className={styles.steps}>
        <li>
          <strong>Téléchargez le projet.</strong> Sur{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            la page GitHub du projet
          </a>
          , cliquez sur le bouton vert « Code », puis « Download ZIP ». Décompressez le fichier. Dans le terminal, tapez{" "}
          <code>cd</code>{" "}suivi d&apos;un espace, glissez le dossier décompressé dans la fenêtre du terminal, puis
          appuyez sur Entrée.
          <br />
          <span className={styles.note}>
            Si vous connaissez Git : <code>git clone {REPO_URL}.git</code> puis <code>cd mouche-vs-humain</code>.
          </span>
        </li>
        <li>
          <strong>Installez les outils du projet</strong>{" "}(une seule fois, 1 à 2 minutes) :
          <pre className={styles.cmd}>npm install</pre>
        </li>
        <li>
          <strong>Lancez le jeu :</strong>
          <pre className={styles.cmd}>npm run dev</pre>
        </li>
        <li>
          <strong>Jouez :</strong> ouvrez{" "}
          <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
            http://localhost:3000
          </a>{" "}
          dans votre navigateur. Pour arrêter, revenez dans le terminal et appuyez sur Ctrl + C.
        </li>
      </ol>

      <h3>Pour aller plus loin (facultatif)</h3>
      <ul>
        <li>
          <strong>Le mettre en ligne :</strong> créez un compte sur{" "}
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            vercel.com
          </a>
          , cliquez sur « Add New… → Project » et importez le projet depuis GitHub. Il n&apos;y a rien à régler : au bout
          de 2 minutes, vous avez votre propre adresse.
        </li>
        <li>
          <strong>Refabriquer le cerveau à partir des données brutes :</strong>{" "}inutile pour jouer. Il faut Python et environ
          12 Go d&apos;espace libre. La marche à suivre est dans le fichier tools/fly-connectome/README.md du
          projet.
        </li>
      </ul>
    </details>
  );
}

export function Credits() {
  return (
    <details className={styles.panel}>
      <summary>Crédits &amp; sources</summary>
      <h3>Données et code réutilisés</h3>
      <ul>
        {DATA_CREDITS.map((c) => (
          <li key={c.url}>
            <strong>{c.what}</strong> — {c.who.endsWith(".") ? c.who : `${c.who}.`} {c.ref}. Licence {c.license}.{" "}
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              {c.url.replace("https://", "")}
            </a>
          </li>
        ))}
        <li>
          Les données FlyWire (licence CC BY-NC) ont servi uniquement hors ligne, pour valider le moteur de simulation ;
          elles ne sont pas utilisées sur cette page.
        </li>
      </ul>
      <h3>Articles</h3>
      <ul className={styles.refs}>
        {REFERENCES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className={styles.note}>
        Projet indépendant, sans lien avec les auteurs ni avec les fabricants de jeux. Détails techniques : fichiers
        SCIENTIFIC_NOTES.md et tools/fly-connectome/REPORT.md du{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          code du projet
        </a>
        .
      </p>
    </details>
  );
}
