# Mouche vs Humain

Jouez au Puissance 4 contre **Simone**, une mouche simulée par ordinateur.

Personne ne lui a appris les règles : elle regarde le plateau, son cerveau réagit, et elle joue la colonne vers
laquelle elle se tourne. Son cerveau est une copie des branchements du cerveau d'une vraie mouche (connectome
MaleCNS).

Version en ligne : https://martindevsaas.com/mouche-puissance-4

## Tuto : faire tourner Simone sur votre ordinateur

Environ 10 minutes, sans rien savoir coder. Ça marche sur Windows, Mac et Linux. Le cerveau de Simone est déjà
inclus dans le projet : il n'y a rien d'autre à télécharger.

### Avant de commencer

- Installez **Node.js** : sur [nodejs.org](https://nodejs.org), cliquez sur le bouton « LTS », puis suivez
  l'installation.
- Ouvrez un **terminal** : sur Windows, cherchez « Terminal » dans le menu Démarrer ; sur Mac, cherchez « Terminal »
  avec Spotlight (Cmd + Espace).

### Les 4 étapes

1. **Téléchargez le projet.** En haut de cette page, cliquez sur le bouton vert « Code », puis « Download ZIP ».
   Décompressez le fichier. Dans le terminal, tapez `cd` suivi d'un espace, glissez le dossier décompressé dans la
   fenêtre du terminal, puis appuyez sur Entrée.

   Si vous connaissez Git :

   ```bash
   git clone https://github.com/Martin-DevSaas/mouche-vs-humain.git
   cd mouche-vs-humain
   ```

2. **Installez les outils du projet** (une seule fois, 1 à 2 minutes) :

   ```bash
   npm install
   ```

3. **Lancez le jeu :**

   ```bash
   npm run dev
   ```

4. **Jouez :** ouvrez http://localhost:3000 dans votre navigateur. Pour arrêter, revenez dans le terminal et appuyez
   sur Ctrl + C.

### Pour aller plus loin (facultatif)

- **Le mettre en ligne :** créez un compte sur [vercel.com](https://vercel.com), cliquez sur « Add New… → Project »
  et importez ce projet depuis GitHub. Il n'y a rien à régler : au bout de 2 minutes, vous avez votre propre adresse.
  Sur votre propre serveur : `npm run build` puis `npm start` (port 3000).
- **Refabriquer le cerveau à partir des données brutes :** inutile pour jouer. Il faut Python (via
  [uv](https://docs.astral.sh/uv/)) et environ 12 Go d'espace libre. Voir
  [tools/fly-connectome/README.md](tools/fly-connectome/README.md).
- **Lancer les tests :** `npm test`.

## Où est quoi

| Dossier | Contenu |
|---|---|
| `src/app/` | la page du jeu |
| `src/features/fly-connect4/` | le jeu, la vue 3D, l'œil de la mouche et la simulation des neurones |
| `public/fly-brain/v1/` | le cerveau de Simone, prêt à l'emploi (environ 27 000 neurones) |
| `tools/fly-connectome/` | les scripts qui fabriquent ce cerveau à partir des données brutes |
| `SCIENTIFIC_NOTES.md` | les choix scientifiques en détail |

## Crédits

- **Connectome MaleCNS v1.0** — Janelia FlyEM, MRC LMB Cambridge, Google Research et al. Berg S. et al., *Cell* 189,
  5504–5526 (2026). Licence CC-BY 4.0. https://male-cns.janelia.org
- **Modèle de neurone** — Shiu P.K. et al., *Nature* 634, 210–219 (2024), reproduit en TypeScript d'après
  [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model) (licence MIT).
- **Enregistrements des neurones du virage** — Rayshubskiy A. et al., *eLife* (2025), Harvard Dataverse
  doi:10.7910/DVN/0NCLP1 (CC0).

La liste complète des sources est dans le panneau « Crédits & sources » du jeu.

Projet indépendant, sans lien avec les auteurs ni avec les fabricants de jeux.

## Licence

Le code est sous licence MIT (voir [LICENSE](LICENSE) et [NOTICE](NOTICE)) : vous pouvez le réutiliser librement, en gardant la mention
de l'auteur. Les fichiers du cerveau (`public/fly-brain/`) viennent du connectome MaleCNS et restent sous licence
CC-BY 4.0 : si vous les réutilisez, citez ses auteurs.
