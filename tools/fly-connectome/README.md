# fly-connectome — pipeline hors ligne

Construit les assets du jeu à partir de MaleCNS v1.0 (Janelia FlyEM et al., CC-BY 4.0).
Les données brutes (environ 9 Go) et les caches sont dans `data/`, qui est gitignoré. Seuls les assets finaux vont dans `public/fly-brain/`.

```bash
cd tools/fly-connectome
uv sync                                   # dépendances épinglées (uv.lock)
uv run python -I 01_download.py           # ~9 Go depuis gs://flyem-male-cns (HTTPS public)
uv run python -I 02_build_subnetwork.py   # options : --w-min 11 -k 5
uv run python -I 03_visual_mapping.py     # colonne hexagonale de chaque entrée
uv run python -I 04_meshes.py             # neuropiles → GLB (utilise npx gltfpack)
uv run python -I 05_export.py             # → public/fly-brain/v1/ (+ .gz)
uv run python -I check_assets.py          # relecture indépendante des assets
```

- **Mémoire maximale** : environ 1,7 Go. Les gros fichiers `.feather` sont lus lot par lot.
- **Durée totale** : environ 10 min sur 2 cœurs, sans compter le téléchargement.
- **Résultats et chiffres** : voir `REPORT.md`.
- **Choix scientifiques** : voir `/SCIENTIFIC_NOTES.md`.

## Format des assets

Tous les binaires sont en little-endian, et chaque tableau commence à un offset aligné sur 4 octets. `meta.json → files.<fichier>.layout` donne pour chaque tableau son `offset`, sa longueur (`length`, en éléments) et son type (`dtype`).

`network.bin` : matrice d'adjacence CSR, une ligne par neurone présynaptique.

| Tableau | Type | Contenu |
|---|---|---|
| `offsets` | Uint32[n + 1] | les cibles du neurone *i* sont `targets[offsets[i] .. offsets[i+1]]` |
| `targets` | Uint16[m] | indice du neurone postsynaptique (n ≤ 65 536) |
| `weights` | Int16[m] | nombre de synapses, négatif si le neurone source est inhibiteur |

`neurons.bin` :

| Tableau | Type | Contenu |
|---|---|---|
| `position` | Float32[3n] | µm (repère MaleCNS × 0,008). Soma s'il est connu, sinon barycentre des T-bars |
| `bodyId` | Uint32[n] | identifiant MaleCNS v1.0 |
| `type` | Uint16[n] | indice dans `meta.types` |
| `superclass` | Uint8[n] | indice dans `meta.superclasses` |
| `side` | Uint8[n] | indice dans `meta.sides` |
| `roi` | Uint8[n] | indice dans `meta.rois` |
| `nt` | Uint8[n] | indice dans `meta.nts` |
| `flags` | Uint8[n] | bit 1 entrée, 2 sortie, 4 inhibiteur, 8 soma connu |
| `hops` | Uint8[n] | distance (en sauts) depuis l'entrée la plus proche |
| `hex1`, `hex2` | Int8[n] | colonne hexagonale de l'entrée (−1 si ce n'est pas une entrée) |

Les neurones sont triés par neuropile principal : le neuropile *r* occupe les indices `meta.rois[r].start` à `start + count`.

`neuropils.glb` : un nœud par neuropile (nom neuPrint), en µm, compressé avec meshopt (`EXT_meshopt_compression`).
