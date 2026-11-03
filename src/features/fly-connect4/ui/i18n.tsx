// Every user-facing text of the game, in French, English and Spanish.
// The host page picks the language with useFlyLang.getState().setLang().

import type { ReactNode } from "react";
import { create } from "zustand";

export type FlyLang = "fr" | "en" | "es";
export const FLY_LANGS: FlyLang[] = ["fr", "en", "es"];

export const useFlyLang = create<{ lang: FlyLang; setLang(lang: FlyLang): void }>((set) => ({
  lang: "fr",
  setLang(lang) {
    set({ lang });
  },
}));

export const REPO_URL = "https://github.com/Martin-DevSaas/mouche-vs-humain";

const ext = (href: string, children: ReactNode) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);
const fmt = (lang: FlyLang, x: number, digits = 2) =>
  x.toLocaleString(lang === "en" ? "en-GB" : lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export interface Dict {
  page: {
    /** Browser tab title. */
    docTitle: string;
    title: string;
    intro: string;
    howTitle: string;
    how: [ReactNode, ReactNode, ReactNode];
    howNote: string;
    brainTitle: string;
    brain: string;
    levelTitle: string;
    level: string;
  };
  game: {
    loadingBoard: string;
    loadingBrain: string;
    yourTurn: string;
    thinking(seconds: number): string;
    clearing: string;
    youWon: string;
    flyWon: string;
    draw: string;
    loadError(message: string): string;
    newGame: string;
    clearBoard: string;
    flyStarts: string;
    sound: string;
    muted: string;
    score(you: number, fly: number, draws: number): string;
    download(pct: number): string;
    preparing: string;
    boardLabel: string;
  };
  brain: {
    mapLabel: string;
    unknownRole: string;
    close: string;
    side(side: string): string;
    sides: { L: string; R: string; M: string };
    transmitter: string;
    mainRegion: string;
    orient: string;
    idle: string;
    live(seconds: number): string;
    done(seconds: number): string;
    neuropilActivity: string;
    superclass: Record<string, string>;
    nt: Record<string, string>;
    gauge: { L: string; R: string };
  };
  vision: {
    title: string;
    choices: Record<"R1-6" | "R8y" | "R7y", string>;
    choicesLabel: string;
    mosaicLabel(receptor: string): string;
    p1(heading: string): ReactNode;
    p2: ReactNode;
  };
  why: {
    title: string;
    thinking: string;
    empty: string;
    turned(right: boolean, column: number): ReactNode;
    straight(column: number): ReactNode;
    rule: string;
    noSignal: string;
    signals(left: number, right: number): ReactNode;
    silenced(label: string): string;
    fallback(from: number): string;
  };
  lab: {
    title: string;
    field: string;
    text: string;
    presets: Record<string, string>;
  };
  tuto: {
    summary: string;
    intro: string;
    beforeTitle: string;
    before: [ReactNode, ReactNode];
    stepsTitle: string;
    download: ReactNode;
    git: ReactNode;
    install: ReactNode;
    run: ReactNode;
    play: ReactNode;
    moreTitle: string;
    more: [ReactNode, ReactNode];
  };
  credits: {
    summary: string;
    dataTitle: string;
    what: Record<"malecns" | "rayshubskiy" | "shiu", string>;
    license: string;
    flywire: string;
    papers: string;
    note: ReactNode;
  };
}

const fr: Dict = {
  page: {
    docTitle: "Mouche vs Humain — Puissance 4 contre un cerveau de mouche simulé",
    title: "Mouche vs Humain",
    intro:
      "Vous jouez les rouges. Simone, une mouche simulée par ordinateur, joue les jaunes. Personne ne lui a appris les règles : elle regarde le plateau, son cerveau réagit, et elle joue la colonne vers laquelle elle se tourne. À droite, vous voyez son cerveau s'allumer pendant qu'elle réfléchit.",
    howTitle: "Comment Simone choisit sa colonne",
    how: [
      <>
        <strong>Elle regarde le plateau.</strong>{" "}On calcule ce que voit chaque petite facette de ses yeux.
      </>,
      <>
        <strong>Son cerveau réagit.</strong>{" "}L&apos;image passe de neurone en neurone, en suivant exactement les
        branchements du cerveau d&apos;une vraie mouche.
      </>,
      <>
        <strong>Elle tourne, puis elle joue.</strong>{" "}Si ses neurones du virage s&apos;activent plus à gauche, elle
        tourne à gauche, et inversement. Quand elle s&apos;arrête, elle joue la colonne en face d&apos;elle.
      </>,
    ],
    howNote: "Aucune règle du Puissance 4 n'est programmée : tout vient de son cerveau.",
    brainTitle: "D'où vient son cerveau ?",
    brain:
      "Des chercheurs ont découpé le cerveau d'une vraie mouche en tranches ultra-fines, les ont photographiées au microscope, puis ont retracé chaque neurone et chaque branchement. Cette carte complète contient 166 700 neurones. Simone en utilise environ 27 000 : ceux qui servent à voir et à tourner.",
    levelTitle: "Est-ce qu'elle joue bien ?",
    level:
      "Non. Sur 1 200 parties de test, elle gagne aussi souvent qu'un joueur qui joue au hasard, avec juste une petite préférence pour la gauche. C'est normal : une mouche n'a jamais appris le Puissance 4. Ce n'est ni une vraie mouche, ni une intelligence artificielle entraînée à gagner, mais la simulation de son cerveau.",
  },
  game: {
    loadingBoard: "Chargement du plateau…",
    loadingBrain: "Chargement du cerveau de Simone…",
    yourTurn: "À vous : cliquez sur une colonne (pions rouges).",
    thinking: (s) => `Simone calcule son coup… ${fmt("fr", s)} s simulées`,
    clearing: "On vide le plateau…",
    youWon: "Vous avez gagné !",
    flyWon: "Simone a gagné !",
    draw: "Match nul.",
    loadError: (m) => `Erreur de chargement : ${m}`,
    newGame: "Nouvelle partie",
    clearBoard: "Vider le plateau",
    flyStarts: "Simone commence",
    sound: "Son",
    muted: "Son coupé",
    score: (y, f, d) => `Score — vous ${y} · Simone ${f} · nuls ${d}`,
    download: (p) => `Téléchargement du connectome… ${p} %`,
    preparing: "Préparation du cerveau…",
    boardLabel: "Plateau de Puissance 4 en 3D",
  },
  brain: {
    mapLabel: "Carte 3D du cerveau de Simone",
    unknownRole: "Rôle inconnu.",
    close: "Fermer",
    side: (s) => ` · côté ${s}`,
    sides: { L: "gauche", R: "droit", M: "médian" },
    transmitter: "Neurotransmetteur :",
    mainRegion: "Région principale :",
    orient: "Vue de face · la droite de Simone est à gauche de l'écran",
    idle: "En attente du premier coup de Simone",
    live: (s) => `Calcul en direct : ${fmt("fr", s)} s simulées`,
    done: (s) => `Fin du calcul : ${fmt("fr", s)} s simulées. La carte garde le dernier état jusqu'au prochain coup.`,
    neuropilActivity: "activité des neuropiles",
    superclass: {
      ol_intrinsic: "lobe optique",
      visual_projection: "projection visuelle",
      visual_centrifugal: "centrifuge visuel",
      cb_intrinsic: "cerveau central",
      descending_neuron: "neurone descendant",
      ascending_neuron: "neurone ascendant",
      vnc_intrinsic: "corde nerveuse",
    },
    nt: {
      acetylcholine: "acétylcholine (excitateur)",
      gaba: "GABA (inhibiteur)",
      glutamate: "glutamate (inhibiteur dans le modèle)",
      histamine: "histamine (inhibiteur)",
      dopamine: "dopamine",
      serotonin: "sérotonine",
      octopamine: "octopamine",
    },
    gauge: { L: "G", R: "D" },
  },
  vision: {
    title: "Ce que voit Simone",
    choices: {
      "R1-6": "R1–6 (utilisées par le modèle)",
      R8y: "R8y (vert, et un peu de rouge)",
      R7y: "R7y (ultraviolet)",
    },
    choicesLabel: "Type de photorécepteur",
    mosaicLabel: (r) => `Mosaïque des facettes de l'œil de Simone, photorécepteurs ${r}`,
    p1: (h) => (
      <>
        L&apos;œil d&apos;une mouche est fait de petites facettes. Chacune reçoit la lumière d&apos;une seule direction.
        Simone en a 1 771 sur ses deux yeux. Chaque hexagone ci-dessus est une facette, et sa couleur indique la
        quantité de lumière qu&apos;elle reçoit quand Simone est orientée à {h}° (0° = face au centre du plateau).
      </>
    ),
    p2: (
      <>
        Les boutons changent le type de cellule de l&apos;œil affiché. La simulation n&apos;utilise que les cellules
        R1–6. Elles captent mal le rouge : pour elles, <strong>les pions rouges paraissent presque noirs</strong>. Les
        cellules R8y captent un peu le rouge et voient donc encore ces pions.
      </>
    ),
  },
  why: {
    title: "Pourquoi Simone a joué ici",
    thinking: "Simone réfléchit…",
    empty: "Après le premier coup de Simone, ce panneau explique en une phrase pourquoi elle a choisi cette colonne.",
    turned: (right, c) => (
      <>
        Son cerveau l&apos;a fait tourner <strong>vers la {right ? "droite" : "gauche"}</strong>, puis elle a joué la
        colonne qu&apos;elle avait en face d&apos;elle : la <strong>colonne {c}</strong>.
      </>
    ),
    straight: (c) => (
      <>
        Son cerveau ne l&apos;a pas fait tourner : elle a joué la colonne qu&apos;elle avait déjà en face d&apos;elle,
        la <strong>colonne {c}</strong>.
      </>
    ),
    rule: "Pour tourner, une mouche utilise quelques neurones du virage, à gauche et à droite : le côté qui envoie le plus de signaux l'emporte.",
    noSignal: "Pendant ce coup, aucun signal ne leur est parvenu.",
    signals: (l, r) => (
      <>
        Pendant ce coup : <strong>{l}</strong> signaux à gauche, <strong>{r}</strong>{" "}à droite.
      </>
    ),
    silenced: (l) => `Expérience en cours : « ${l} » était éteint pendant ce coup.`,
    fallback: (f) =>
      `Elle visait la colonne ${f}, mais elle était pleine : elle a joué la colonne libre la plus proche.`,
  },
  lab: {
    title: "Expérience : éteindre une partie de son cerveau",
    field: "Partie à éteindre",
    text: "C'est ce que font les chercheurs pour comprendre à quoi sert un neurone. Essayez d'éteindre les neurones du virage : Simone ne tourne presque plus et joue toujours la colonne qu'elle a en face d'elle.",
    presets: {
      none: "Rien (cerveau complet)",
      "ol-l": "Toute la vision gauche",
      "ol-r": "Toute la vision droite",
      dna02: "Les neurones du virage (DNa02)",
      "dna02-l": "Neurone du virage gauche (DNa02)",
      "dna02-r": "Neurone du virage droit (DNa02)",
    },
  },
  tuto: {
    summary: "Tuto : faire tourner Simone sur votre ordinateur",
    intro:
      "Environ 10 minutes, sans rien savoir coder. Ça marche sur Windows, Mac et Linux. Le cerveau de Simone est déjà inclus dans le projet : il n'y a rien d'autre à télécharger.",
    beforeTitle: "Avant de commencer",
    before: [
      <>
        Installez <strong>Node.js</strong> : sur {ext("https://nodejs.org", "nodejs.org")}, cliquez sur le bouton «
        LTS », puis suivez l&apos;installation.
      </>,
      <>
        Ouvrez un <strong>terminal</strong>{" "}: sur Windows, cherchez « Terminal » dans le menu Démarrer ; sur Mac,
        cherchez « Terminal » avec Spotlight (Cmd + Espace).
      </>,
    ],
    stepsTitle: "Les 4 étapes",
    download: (
      <>
        <strong>Téléchargez le projet.</strong> Sur {ext(REPO_URL, "la page GitHub du projet")}, cliquez sur le bouton
        vert « Code », puis « Download ZIP ». Décompressez le fichier. Dans le terminal, tapez <code>cd</code>{" "}suivi
        d&apos;un espace, glissez le dossier décompressé dans la fenêtre du terminal, puis appuyez sur Entrée.
      </>
    ),
    git: (
      <>
        Si vous connaissez Git : <code>git clone {REPO_URL}.git</code> puis <code>cd mouche-vs-humain</code>.
      </>
    ),
    install: (
      <>
        <strong>Installez les outils du projet</strong>{" "}(une seule fois, 1 à 2 minutes) :
      </>
    ),
    run: <strong>Lancez le jeu :</strong>,
    play: (
      <>
        <strong>Jouez :</strong> ouvrez {ext("http://localhost:3000", "http://localhost:3000")}{" "}dans votre navigateur.
        Pour arrêter, revenez dans le terminal et appuyez sur Ctrl + C.
      </>
    ),
    moreTitle: "Pour aller plus loin (facultatif)",
    more: [
      <>
        <strong>Le mettre en ligne :</strong> créez un compte sur {ext("https://vercel.com", "vercel.com")}, cliquez
        sur « Add New… → Project » et importez le projet depuis GitHub. Il n&apos;y a rien à régler : au bout de 2
        minutes, vous avez votre propre adresse.
      </>,
      <>
        <strong>Refabriquer le cerveau à partir des données brutes :</strong>{" "}inutile pour jouer. Il faut Python et
        environ 12 Go d&apos;espace libre. La marche à suivre est dans le fichier tools/fly-connectome/README.md du
        projet.
      </>,
    ],
  },
  credits: {
    summary: "Crédits & sources",
    dataTitle: "Données et code réutilisés",
    what: {
      malecns:
        "Connectome MaleCNS v1.0 (neurones, synapses, neurotransmetteurs prédits, neuropiles, colonnes optiques)",
      rayshubskiy: "Enregistrements de DNa01/DNa02 utilisés pour mesurer le gain de virage",
      shiu: "Modèle de neurone (paramètres et équations), reproduit en TypeScript",
    },
    license: "Licence",
    flywire:
      "Les données FlyWire (licence CC BY-NC) ont servi uniquement hors ligne, pour valider le moteur de simulation ; elles ne sont pas utilisées sur cette page.",
    papers: "Articles",
    note: (
      <>
        Projet indépendant, sans lien avec les auteurs ni avec les fabricants de jeux. Détails techniques : fichiers
        SCIENTIFIC_NOTES.md et tools/fly-connectome/REPORT.md du {ext(REPO_URL, "code du projet")}.
      </>
    ),
  },
};

const en: Dict = {
  page: {
    docTitle: "Fly vs Human — Connect Four against a simulated fly brain",
    title: "Fly vs Human",
    intro:
      "You play red. Simone, a computer-simulated fly, plays yellow. Nobody taught her the rules: she looks at the board, her brain reacts, and she plays the column she turns towards. On the right, you can watch her brain light up while she thinks.",
    howTitle: "How Simone picks a column",
    how: [
      <>
        <strong>She looks at the board.</strong>{" "}We compute what each tiny facet of her eyes sees.
      </>,
      <>
        <strong>Her brain reacts.</strong>{" "}The image travels from neuron to neuron, following exactly the wiring of a
        real fly&apos;s brain.
      </>,
      <>
        <strong>She turns, then plays.</strong>{" "}If her turning neurons fire more on the left, she turns left, and vice
        versa. When she stops, she plays the column in front of her.
      </>,
    ],
    howNote: "No Connect Four rule is programmed: everything comes from her brain.",
    brainTitle: "Where does her brain come from?",
    brain:
      "Researchers sliced the brain of a real fly into ultra-thin layers, photographed them under a microscope, then traced every neuron and every connection. This complete map has 166,700 neurons. Simone uses about 27,000 of them: the ones used for seeing and turning.",
    levelTitle: "Is she any good?",
    level:
      "No. Over 1,200 test games, she wins as often as a player who plays at random, with just a slight preference for the left. That is expected: a fly has never learned Connect Four. This is neither a real fly nor an AI trained to win, but a simulation of her brain.",
  },
  game: {
    loadingBoard: "Loading the board…",
    loadingBrain: "Loading Simone's brain…",
    yourTurn: "Your turn: click a column (red pieces).",
    thinking: (s) => `Simone is computing her move… ${fmt("en", s)} s simulated`,
    clearing: "Clearing the board…",
    youWon: "You won!",
    flyWon: "Simone won!",
    draw: "Draw.",
    loadError: (m) => `Loading error: ${m}`,
    newGame: "New game",
    clearBoard: "Clear the board",
    flyStarts: "Simone goes first",
    sound: "Sound",
    muted: "Sound off",
    score: (y, f, d) => `Score — you ${y} · Simone ${f} · draws ${d}`,
    download: (p) => `Downloading the connectome… ${p}%`,
    preparing: "Preparing the brain…",
    boardLabel: "3D Connect Four board",
  },
  brain: {
    mapLabel: "3D map of Simone's brain",
    unknownRole: "Role unknown.",
    close: "Close",
    side: (s) => ` · ${s} side`,
    sides: { L: "left", R: "right", M: "midline" },
    transmitter: "Neurotransmitter:",
    mainRegion: "Main region:",
    orient: "Front view · Simone's right is on the left of the screen",
    idle: "Waiting for Simone's first move",
    live: (s) => `Live computation: ${fmt("en", s)} s simulated`,
    done: (s) => `Computation finished: ${fmt("en", s)} s simulated. The map keeps the last state until the next move.`,
    neuropilActivity: "neuropil activity",
    superclass: {
      ol_intrinsic: "optic lobe",
      visual_projection: "visual projection",
      visual_centrifugal: "visual centrifugal",
      cb_intrinsic: "central brain",
      descending_neuron: "descending neuron",
      ascending_neuron: "ascending neuron",
      vnc_intrinsic: "nerve cord",
    },
    nt: {
      acetylcholine: "acetylcholine (excitatory)",
      gaba: "GABA (inhibitory)",
      glutamate: "glutamate (inhibitory in the model)",
      histamine: "histamine (inhibitory)",
      dopamine: "dopamine",
      serotonin: "serotonin",
      octopamine: "octopamine",
    },
    gauge: { L: "L", R: "R" },
  },
  vision: {
    title: "What Simone sees",
    choices: {
      "R1-6": "R1–6 (used by the model)",
      R8y: "R8y (green, and a little red)",
      R7y: "R7y (ultraviolet)",
    },
    choicesLabel: "Photoreceptor type",
    mosaicLabel: (r) => `Mosaic of the facets of Simone's eye, ${r} photoreceptors`,
    p1: (h) => (
      <>
        A fly&apos;s eye is made of tiny facets. Each one receives light from a single direction. Simone has 1,771 of
        them across both eyes. Each hexagon above is a facet, and its colour shows how much light it receives when
        Simone faces {h}° (0° = facing the centre of the board).
      </>
    ),
    p2: (
      <>
        The buttons change which type of eye cell is shown. The simulation only uses R1–6 cells. They barely detect
        red: to them, <strong>the red pieces look almost black</strong>. R8y cells detect a little red, so they still
        see those pieces.
      </>
    ),
  },
  why: {
    title: "Why Simone played here",
    thinking: "Simone is thinking…",
    empty: "After Simone's first move, this panel explains in one sentence why she chose that column.",
    turned: (right, c) => (
      <>
        Her brain turned her <strong>to the {right ? "right" : "left"}</strong>, then she played the column in front
        of her: <strong>column {c}</strong>.
      </>
    ),
    straight: (c) => (
      <>
        Her brain did not turn her: she played the column that was already in front of her,{" "}
        <strong>column {c}</strong>.
      </>
    ),
    rule: "To turn, a fly uses a few turning neurons, on the left and on the right: the side that sends more signals wins.",
    noSignal: "During this move, no signal reached them.",
    signals: (l, r) => (
      <>
        During this move: <strong>{l}</strong> signals on the left, <strong>{r}</strong>{" "}on the right.
      </>
    ),
    silenced: (l) => `Experiment running: “${l}” was switched off during this move.`,
    fallback: (f) => `She was aiming for column ${f}, but it was full: she played the nearest free column.`,
  },
  lab: {
    title: "Experiment: switch off part of her brain",
    field: "Part to switch off",
    text: "This is what researchers do to find out what a neuron is for. Try switching off the turning neurons: Simone barely turns any more and always plays the column in front of her.",
    presets: {
      none: "Nothing (whole brain)",
      "ol-l": "All of the left vision",
      "ol-r": "All of the right vision",
      dna02: "The turning neurons (DNa02)",
      "dna02-l": "Left turning neuron (DNa02)",
      "dna02-r": "Right turning neuron (DNa02)",
    },
  },
  tuto: {
    summary: "Tutorial: run Simone on your computer",
    intro:
      "About 10 minutes, no coding knowledge needed. Works on Windows, Mac and Linux. Simone's brain is already included in the project: there is nothing else to download.",
    beforeTitle: "Before you start",
    before: [
      <>
        Install <strong>Node.js</strong>: on {ext("https://nodejs.org", "nodejs.org")}, click the “LTS” button, then
        follow the installer.
      </>,
      <>
        Open a <strong>terminal</strong>: on Windows, search for “Terminal” in the Start menu; on Mac, search for
        “Terminal” with Spotlight (Cmd + Space).
      </>,
    ],
    stepsTitle: "The 4 steps",
    download: (
      <>
        <strong>Download the project.</strong> On {ext(REPO_URL, "the project's GitHub page")}, click the green “Code”
        button, then “Download ZIP”. Unzip the file. In the terminal, type <code>cd</code>{" "}followed by a space, drag
        the unzipped folder into the terminal window, then press Enter.
      </>
    ),
    git: (
      <>
        If you know Git: <code>git clone {REPO_URL}.git</code> then <code>cd mouche-vs-humain</code>.
      </>
    ),
    install: (
      <>
        <strong>Install the project&apos;s tools</strong>{" "}(only once, 1 to 2 minutes):
      </>
    ),
    run: <strong>Start the game:</strong>,
    play: (
      <>
        <strong>Play:</strong> open {ext("http://localhost:3000", "http://localhost:3000")}{" "}in your browser. To stop,
        go back to the terminal and press Ctrl + C.
      </>
    ),
    moreTitle: "Going further (optional)",
    more: [
      <>
        <strong>Put it online:</strong> create an account on {ext("https://vercel.com", "vercel.com")}, click “Add
        New… → Project” and import the project from GitHub. There is nothing to configure: after 2 minutes, you have
        your own address.
      </>,
      <>
        <strong>Rebuild the brain from the raw data:</strong>{" "}not needed to play. You need Python and about 12 GB of
        free space. The instructions are in the project&apos;s tools/fly-connectome/README.md file.
      </>,
    ],
  },
  credits: {
    summary: "Credits & sources",
    dataTitle: "Data and code reused",
    what: {
      malecns: "MaleCNS v1.0 connectome (neurons, synapses, predicted neurotransmitters, neuropils, optic columns)",
      rayshubskiy: "DNa01/DNa02 recordings used to measure the turning gain",
      shiu: "Neuron model (parameters and equations), reimplemented in TypeScript",
    },
    license: "Licence",
    flywire:
      "The FlyWire data (CC BY-NC licence) were used offline only, to validate the simulation engine; they are not used on this page.",
    papers: "Papers",
    note: (
      <>
        Independent project, not affiliated with the authors or with any game maker. Technical details: the
        SCIENTIFIC_NOTES.md and tools/fly-connectome/REPORT.md files of the {ext(REPO_URL, "project's code")}.
      </>
    ),
  },
};

const es: Dict = {
  page: {
    docTitle: "Mosca vs Humano — Conecta 4 contra un cerebro de mosca simulado",
    title: "Mosca vs Humano",
    intro:
      "Tú juegas con las rojas. Simone, una mosca simulada por ordenador, juega con las amarillas. Nadie le ha enseñado las reglas: mira el tablero, su cerebro reacciona y juega la columna hacia la que se gira. A la derecha, puedes ver cómo se ilumina su cerebro mientras piensa.",
    howTitle: "Cómo elige Simone su columna",
    how: [
      <>
        <strong>Mira el tablero.</strong>{" "}Calculamos lo que ve cada pequeña faceta de sus ojos.
      </>,
      <>
        <strong>Su cerebro reacciona.</strong>{" "}La imagen pasa de neurona en neurona, siguiendo exactamente las
        conexiones del cerebro de una mosca real.
      </>,
      <>
        <strong>Gira y luego juega.</strong>{" "}Si sus neuronas del giro se activan más a la izquierda, gira a la
        izquierda, y al revés. Cuando se detiene, juega la columna que tiene delante.
      </>,
    ],
    howNote: "No hay ninguna regla del Conecta 4 programada: todo sale de su cerebro.",
    brainTitle: "¿De dónde viene su cerebro?",
    brain:
      "Unos investigadores cortaron el cerebro de una mosca real en láminas ultrafinas, las fotografiaron al microscopio y después reconstruyeron cada neurona y cada conexión. Este mapa completo contiene 166 700 neuronas. Simone usa unas 27 000: las que sirven para ver y para girar.",
    levelTitle: "¿Juega bien?",
    level:
      "No. En 1200 partidas de prueba, gana tan a menudo como un jugador que juega al azar, con solo una ligera preferencia por la izquierda. Es normal: una mosca nunca ha aprendido a jugar al Conecta 4. No es una mosca de verdad ni una inteligencia artificial entrenada para ganar, sino la simulación de su cerebro.",
  },
  game: {
    loadingBoard: "Cargando el tablero…",
    loadingBrain: "Cargando el cerebro de Simone…",
    yourTurn: "Tu turno: haz clic en una columna (fichas rojas).",
    thinking: (s) => `Simone calcula su jugada… ${fmt("es", s)} s simulados`,
    clearing: "Vaciando el tablero…",
    youWon: "¡Has ganado!",
    flyWon: "¡Simone ha ganado!",
    draw: "Empate.",
    loadError: (m) => `Error de carga: ${m}`,
    newGame: "Nueva partida",
    clearBoard: "Vaciar el tablero",
    flyStarts: "Simone empieza",
    sound: "Sonido",
    muted: "Sonido desactivado",
    score: (y, f, d) => `Marcador — tú ${y} · Simone ${f} · empates ${d}`,
    download: (p) => `Descargando el conectoma… ${p} %`,
    preparing: "Preparando el cerebro…",
    boardLabel: "Tablero de Conecta 4 en 3D",
  },
  brain: {
    mapLabel: "Mapa 3D del cerebro de Simone",
    unknownRole: "Función desconocida.",
    close: "Cerrar",
    side: (s) => ` · lado ${s}`,
    sides: { L: "izquierdo", R: "derecho", M: "medio" },
    transmitter: "Neurotransmisor:",
    mainRegion: "Región principal:",
    orient: "Vista frontal · la derecha de Simone está a la izquierda de la pantalla",
    idle: "Esperando la primera jugada de Simone",
    live: (s) => `Cálculo en directo: ${fmt("es", s)} s simulados`,
    done: (s) =>
      `Fin del cálculo: ${fmt("es", s)} s simulados. El mapa conserva el último estado hasta la siguiente jugada.`,
    neuropilActivity: "actividad de los neurópilos",
    superclass: {
      ol_intrinsic: "lóbulo óptico",
      visual_projection: "proyección visual",
      visual_centrifugal: "centrífuga visual",
      cb_intrinsic: "cerebro central",
      descending_neuron: "neurona descendente",
      ascending_neuron: "neurona ascendente",
      vnc_intrinsic: "cordón nervioso",
    },
    nt: {
      acetylcholine: "acetilcolina (excitadora)",
      gaba: "GABA (inhibidora)",
      glutamate: "glutamato (inhibidor en el modelo)",
      histamine: "histamina (inhibidora)",
      dopamine: "dopamina",
      serotonin: "serotonina",
      octopamine: "octopamina",
    },
    gauge: { L: "I", R: "D" },
  },
  vision: {
    title: "Lo que ve Simone",
    choices: {
      "R1-6": "R1–6 (usadas por el modelo)",
      R8y: "R8y (verde, y un poco de rojo)",
      R7y: "R7y (ultravioleta)",
    },
    choicesLabel: "Tipo de fotorreceptor",
    mosaicLabel: (r) => `Mosaico de las facetas del ojo de Simone, fotorreceptores ${r}`,
    p1: (h) => (
      <>
        El ojo de una mosca está formado por pequeñas facetas. Cada una recibe la luz de una sola dirección. Simone
        tiene 1771 entre sus dos ojos. Cada hexágono de arriba es una faceta, y su color indica la cantidad de luz que
        recibe cuando Simone está orientada a {h}° (0° = frente al centro del tablero).
      </>
    ),
    p2: (
      <>
        Los botones cambian el tipo de célula del ojo que se muestra. La simulación solo usa las células R1–6. Captan
        mal el rojo: para ellas, <strong>las fichas rojas parecen casi negras</strong>. Las células R8y captan un poco
        el rojo y por eso todavía ven esas fichas.
      </>
    ),
  },
  why: {
    title: "Por qué Simone ha jugado aquí",
    thinking: "Simone está pensando…",
    empty: "Después de la primera jugada de Simone, este panel explica en una frase por qué eligió esa columna.",
    turned: (right, c) => (
      <>
        Su cerebro la hizo girar <strong>hacia la {right ? "derecha" : "izquierda"}</strong>{" "}y después jugó la
        columna que tenía delante: la <strong>columna {c}</strong>.
      </>
    ),
    straight: (c) => (
      <>
        Su cerebro no la hizo girar: jugó la columna que ya tenía delante, la <strong>columna {c}</strong>.
      </>
    ),
    rule: "Para girar, una mosca usa unas pocas neuronas del giro, a la izquierda y a la derecha: gana el lado que envía más señales.",
    noSignal: "Durante esta jugada, no les llegó ninguna señal.",
    signals: (l, r) => (
      <>
        Durante esta jugada: <strong>{l}</strong> señales a la izquierda, <strong>{r}</strong>{" "}a la derecha.
      </>
    ),
    silenced: (l) => `Experimento en curso: «${l}» estaba apagado durante esta jugada.`,
    fallback: (f) =>
      `Apuntaba a la columna ${f}, pero estaba llena: jugó la columna libre más cercana.`,
  },
  lab: {
    title: "Experimento: apagar una parte de su cerebro",
    field: "Parte que apagar",
    text: "Es lo que hacen los investigadores para entender para qué sirve una neurona. Prueba a apagar las neuronas del giro: Simone casi no gira y juega siempre la columna que tiene delante.",
    presets: {
      none: "Nada (cerebro completo)",
      "ol-l": "Toda la visión izquierda",
      "ol-r": "Toda la visión derecha",
      dna02: "Las neuronas del giro (DNa02)",
      "dna02-l": "Neurona del giro izquierda (DNa02)",
      "dna02-r": "Neurona del giro derecha (DNa02)",
    },
  },
  tuto: {
    summary: "Tutorial: ejecutar Simone en tu ordenador",
    intro:
      "Unos 10 minutos, sin saber programar. Funciona en Windows, Mac y Linux. El cerebro de Simone ya está incluido en el proyecto: no hay que descargar nada más.",
    beforeTitle: "Antes de empezar",
    before: [
      <>
        Instala <strong>Node.js</strong>: en {ext("https://nodejs.org", "nodejs.org")}, haz clic en el botón «LTS» y
        sigue la instalación.
      </>,
      <>
        Abre un <strong>terminal</strong>: en Windows, busca «Terminal» en el menú Inicio; en Mac, busca «Terminal» con
        Spotlight (Cmd + Espacio).
      </>,
    ],
    stepsTitle: "Los 4 pasos",
    download: (
      <>
        <strong>Descarga el proyecto.</strong> En {ext(REPO_URL, "la página de GitHub del proyecto")}, haz clic en el
        botón verde «Code» y luego en «Download ZIP». Descomprime el archivo. En el terminal, escribe <code>cd</code>{" "}
        seguido de un espacio, arrastra la carpeta descomprimida a la ventana del terminal y pulsa Intro.
      </>
    ),
    git: (
      <>
        Si conoces Git: <code>git clone {REPO_URL}.git</code> y después <code>cd mouche-vs-humain</code>.
      </>
    ),
    install: (
      <>
        <strong>Instala las herramientas del proyecto</strong>{" "}(solo una vez, de 1 a 2 minutos):
      </>
    ),
    run: <strong>Inicia el juego:</strong>,
    play: (
      <>
        <strong>Juega:</strong> abre {ext("http://localhost:3000", "http://localhost:3000")}{" "}en tu navegador. Para
        detenerlo, vuelve al terminal y pulsa Ctrl + C.
      </>
    ),
    moreTitle: "Para ir más lejos (opcional)",
    more: [
      <>
        <strong>Publicarlo en internet:</strong> crea una cuenta en {ext("https://vercel.com", "vercel.com")}, haz clic
        en «Add New… → Project» e importa el proyecto desde GitHub. No hay nada que configurar: en 2 minutos tienes tu
        propia dirección.
      </>,
      <>
        <strong>Reconstruir el cerebro a partir de los datos brutos:</strong>{" "}no hace falta para jugar. Necesitas
        Python y unos 12 GB de espacio libre. Las instrucciones están en el archivo tools/fly-connectome/README.md del
        proyecto.
      </>,
    ],
  },
  credits: {
    summary: "Créditos y fuentes",
    dataTitle: "Datos y código reutilizados",
    what: {
      malecns: "Conectoma MaleCNS v1.0 (neuronas, sinapsis, neurotransmisores predichos, neurópilos, columnas ópticas)",
      rayshubskiy: "Registros de DNa01/DNa02 usados para medir la ganancia de giro",
      shiu: "Modelo de neurona (parámetros y ecuaciones), reproducido en TypeScript",
    },
    license: "Licencia",
    flywire:
      "Los datos de FlyWire (licencia CC BY-NC) se usaron solo sin conexión, para validar el motor de simulación; no se usan en esta página.",
    papers: "Artículos",
    note: (
      <>
        Proyecto independiente, sin relación con los autores ni con los fabricantes de juegos. Detalles técnicos:
        archivos SCIENTIFIC_NOTES.md y tools/fly-connectome/REPORT.md del {ext(REPO_URL, "código del proyecto")}.
      </>
    ),
  },
};

const DICTS: Record<FlyLang, Dict> = { fr, en, es };

/** Texts in the current language, plus the language itself. */
export function useT(): Dict & { lang: FlyLang } {
  const lang = useFlyLang((s) => s.lang);
  return { ...DICTS[lang], lang };
}
