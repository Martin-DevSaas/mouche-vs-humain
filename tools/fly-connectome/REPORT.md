# Rapport du pipeline — Mouche vs Humain

Généré à partir de MaleCNS v1.0 (Janelia FlyEM et al., CC-BY 4.0) le 2026-10-26.
Chaque chiffre vient de `data/subnet/stats.json`, `data/visual/stats.json` ou de la
sortie de `05_export.py`, et peut être reproduit avec `uv run python -I 0X_*.py`.

## Phase 1 — Données et sous-réseau

### 1.1 Données téléchargées (bucket public `gs://flyem-male-cns`)

| Fichier | Taille | Utilisé pour |
|---|---|---|
| `body-annotations-…-minconf-0.5.feather` | 14 Mo | types, superclasses, côté, colonnes hexagonales, soma |
| `body-neurotransmitters-….feather` | 43 Mo | NT consensus (secours si aucune T-bar) |
| `connectome-weights-…-minconf-0.5.feather` | 1,05 Go | poids neurone → neurone (152 M de lignes) |
| `tbar-neurotransmitters-….feather` | 2,65 Go | règle de signe de Shiu, appliquée par T-bar |
| `neuprint-inputs/Neuprint_Neurons.feather` | 4,65 Go | `roiInfo` : neuropile principal de chaque neurone |
| `neuprint-inputs/Neuprint_Meta.csv` | 1,2 Mo | liste des neuropiles primaires |
| `roisSmoothedDecimated/*` (359 OBJ) | 268 Mo | maillages des neuropiles (ceux de `fetch_roi_mesh`) |

`body-stats` (778 Mo) a été écarté : il ne détaille pas les synapses par neuropile. Aucun token neuPrint n'est nécessaire. `syn-points` et `syn-partners` ne sont pas téléchargés.

### 1.2 Neurones

- Un neurone = un corps annoté avec une `superclass` : **166 700**, le chiffre de l'article.
- **25,6 M** de connexions et **124,2 M** de synapses entre ces neurones.
- **Sorties** (une seule par type et par côté) : DNa02 G (523769), DNa02 D (10360),
  DNa01 G (10442), DNa01 D (10760). Les quatre sont cholinergiques (excitatrices).
- **Entrées** : L1, L2 et L3 (cellules monopolaires de la lamina), deux yeux,
  toutes les colonnes. On compte 5 326 neurones et **879 colonnes à gauche, 892 à droite**.
  - Les photorécepteurs ne servent pas d'entrée : seuls 6 091 R1–R8 sont présents, et aucun n'a de colonne.
  - Les **L3 gauches n'ont pas de colonne** dans la v1.0. Leur colonne est déduite par vote synaptique : la colonne des partenaires postsynaptiques, pondérée par le nombre de synapses.
  - Validation du vote sur les 4 425 entrées dont la colonne est connue : 99,9 % de correspondance exacte, 100 % à une colonne près.

### 1.3 Règle de signe (Shiu et al. 2024, méthodes de la prépublication)

> « We assume GABAergic and glutamatergic neurons are inhibitory » ;
> un neurone est inhibiteur si plus de la moitié de ses sites présynaptiques sont GABA/Glu.

- **Application ici** : on prend le neurotransmetteur le plus probable de chaque T-bar (confiance ≥ 0,5), puis on calcule la part GABA + Glu sur tout le neurone.
- **Écart documenté** : l'histamine compte comme inhibitrice. Elle est absente des données FlyWire de Shiu, et ses récepteurs chez la drosophile sont des canaux chlore.
- **Effet de l'écart** : 63 neurones du sous-réseau changent de signe, et c'est **uniquement** dû à l'histamine (0 désaccord sinon).
- **Bilan** : 22,1 % de neurones inhibiteurs dans le sous-réseau.

### 1.4 Sélection du sous-réseau

On garde les neurones situés sur un chemin entrée → sortie d'au plus **K = 5 sauts**. Pour chercher ces chemins, on ne prend que les connexions d'au moins **11 synapses**. Une fois les neurones choisis, le réseau simulé contient **toutes** les connexions entre eux, quel que soit leur poids.

**Pourquoi cette sélection est justifiée** : dans le modèle LIF de Shiu, les neurones n'ont pas d'activité spontanée. Un neurone que les entrées n'atteignent pas ne décharge donc jamais, et un neurone qui n'atteint pas les sorties ne peut pas les influencer. Seule la coupe (K, w_min) est une approximation.

| Réglage exploré | Neurones | Connexions | Entrées des DN conservées |
|---|---|---|---|
| w ≥ 5, K = 4 | 35 372 | 1,82 M | 72–78 % |
| w ≥ 10, K = 5 (L3 G inclus) | 60 696 | 5,02 M | 92–93 % (hors budget) |
| **w ≥ 11, K = 5 (retenu)** | **54 148** | **3,89 M** | **89–92 %** |
| w ≥ 12, K = 5 | 48 072 | 3,03 M | 86–88 % |

**Résultat retenu** :
- 54 148 neurones et 3 889 207 connexions (21,5 M de synapses).
- 17,4 % des synapses du cerveau entier.
- Médiane des entrées conservées par neurone : 66,7 %.

| Distance depuis l'entrée | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Neurones | 5 326 | 20 244 | 23 590 | 4 395 | 593 |

- **Chemin le plus court** vers DNa02 : 3 sauts, L1/L2/L3 → Tm3 (ou Tm5c, Tm4) → LLPC1 (ou LoVP18) → DNa02.
- **DNa01** est à 4 sauts.
- Rayshubskiy et al. (2025) décrivent des neurones de projection visuelle qui projettent directement sur DNa02 : c'est cohérent.

**Superclasses** :

| Superclasse | Neurones |
|---|---|
| ol_intrinsic | 47 861 |
| visual_projection | 3 073 |
| cb_intrinsic | 2 700 |
| descending_neuron | 268 |
| visual_centrifugal | 77 |
| vnc_intrinsic | 62 |
| ascending_neuron | 59 |
| ol_sensory | 48 |

**Neuropiles principaux** (nombre de neurones) :

| Neuropile | Neurones |
|---|---|
| ME(R) | 22 382 |
| ME(L) | 18 159 |
| LO(R) | 4 791 |
| LO(L) | 3 242 |
| LOP(R) | 462 |
| LA(R) | 432 |
| LOP(L) | 397 |
| LA(L) | 393 |
| PVLP(R) | 376 |
| AVLP(R) | 319 |
| PVLP(L) | 311 |
| AVLP(L) | 259 |
| AOTU(L) | 240 |
| GNG | 214 |
| AOTU(R) | 205 |
| PLP | 360 (D 196, G 164) |
| LAL | 240 (G 139, D 101) |

Le sous-réseau compte **1 897 types**. Les plus nombreux : Tm3 (2 052), L1/L2/L3, Tm1, Mi1, Tm2, L5, Mi9, T2a, Tm9, T4a/b et T5a/b.

### 1.5 ⚠️ Asymétrie gauche/droite à surveiller

Les données complètes sont symétriques : 49 407 neurones optiques à droite, 49 195 à gauche. En revanche, le **lobe optique droit a des poids 5 à 10 % plus élevés**. Exemple : L2 → Tm1 vaut en moyenne 105 synapses à droite contre 93 à gauche. Le lobe droit est celui de Nern et al. 2025, relu plus en détail.

Avec un seuil fixe, cet écart se retrouve dans la sélection :
- ol_intrinsic : 26 614 neurones à droite contre 21 247 à gauche ;
- les plus touchés sont T4/T5 c/d, T3 et TmY18 (voies du mouvement vertical).

Les côtés centraux restent équilibrés :

| Superclasse | Droite | Gauche |
|---|---|---|
| cb_intrinsic | 1 388 | 1 294 |
| descending_neuron | 136 | 131 |

Les DNa01/DNa02 des deux côtés gardent 89 à 92 % de leurs entrées.

**À tester en phase 2** :
1. Stimulus symétrique : les DNa02 G et D sont-ils activés de la même façon ?
2. Comparaison sous-réseau / cerveau entier (166 700 neurones, hors ligne) sur les mêmes entrées.

Si un biais de virage apparaît, il sera mesuré et affiché tel quel, sans correction neurone par neurone.

### 1.6 Assets produits (`public/fly-brain/v1/`)

| Fichier | Brut | gzip -9 |
|---|---|---|
| `network.bin` (CSR : Uint32 offsets, Uint16 cibles, Int16 poids signés) | 15,77 Mo | 7,81 Mo |
| `neurons.bin` (positions, bodyId, type, superclasse, côté, neuropile, NT, drapeaux, colonnes) | 1,41 Mo | 0,64 Mo |
| `meta.json` (dictionnaires, plan des octets, sorties, paramètres Shiu, crédits) | 0,02 Mo | 0,01 Mo |
| `neuropils.glb` (82 neuropiles, 176 551 triangles, meshopt) | 0,58 Mo | 0,42 Mo |
| **Total** | **17,78 Mo** | **8,88 Mo** (budget : 25 Mo) |

**Position 3D** : le soma pour 47 533 neurones, sinon le barycentre des T-bars. Chaque neurone a une position.

**Vérification indépendante** (`check_assets.py`) : les fichiers sont relus depuis `meta.json` seul et comparés aux tables du pipeline.
- les connexions sont identiques une à une ;
- le signe de chaque connexion correspond au drapeau inhibiteur de son neurone source ;
- les sorties ont le bon type et les plages de neuropiles sont contiguës ;
- toutes les entrées ont une colonne.

Image de contrôle : `data/check_assets.png`.

## Phase 2 — Moteur de simulation et validation

### 2.1 Moteur

Le moteur `src/features/fly-connect4/sim/lif.ts` est un portage pas à pas du `model.py` de Shiu et al. :
- **source** : github.com/philshiu/Drosophila_brain_model, commit `91bdd1e`, SHA-256 `fc45837d…`, licence MIT ;
- **paramètres** : v_repos = v_reset = −52 mV, seuil −45 mV, τm 20 ms, τsyn 5 ms, période réfractaire 2,2 ms, délai 1,8 ms, 0,275 mV par synapse, dt 0,1 ms (valeur par défaut de Brian2) ;
- **entrée de Poisson** : v += 0,275 × 250 = 68,75 mV, et les neurones stimulés n'ont pas de période réfractaire ;
- **intégration exacte** du système linéaire, en Float64 comme Brian2 ;
- **même ordre d'exécution que Brian2 à chaque pas** : intégration → seuil → synapses → remise à zéro ;
- **délai** géré par un buffer circulaire de 19 cases ;
- **propagation événementielle** : seuls les neurones qui déchargent envoient des événements.

**Point découvert en validation** : le drapeau `(unless refractory)` rend v et g en *écriture conditionnelle* dans Brian2 (`neurongroup.py`, `set_conditional_write`). Tout événement qui arrive sur un neurone réfractaire, ou sur un neurone en train de décharger, est **perdu**, et non stocké. Ma première version les accumulait : 45 % de spikes identiques seulement. Une fois corrigée, la concordance est de 100 %.

Les 19 tests unitaires (Vitest) couvrent :
- la relaxation et la réponse synaptique comparées à la solution analytique, à 10⁻¹⁰ près ;
- l'instant du premier spike ;
- l'ordre des opérations de Brian2 ;
- le délai de 18 pas ;
- les événements perdus pendant la période réfractaire ;
- un réseau de 3 neurones calculé à la main (excitation, puis annulation exacte par l'inhibition) ;
- le silençage ;
- la reproductibilité à partir de la graine, et le taux de Poisson (4σ) ;
- la cohérence des assets ;
- l'égalité exacte entre un calcul d'un seul tenant et un calcul découpé en fenêtres.

### 2.2 Validation croisée contre Brian2 2.10.1 (`06_validate_reference.py brian2`)

Conditions :
- même sous-réseau (54 148 neurones), 1 s simulée ;
- entrées L1/L2/L3 à 150 Hz, sur 30 % (1 598 neurones) ou 100 % (5 326) des entrées ;
- le réseau Brian2 est construit par le `create_model` de Shiu.

| Test | 30 % des entrées | 100 % des entrées |
|---|---|---|
| **Déterministe** (mêmes événements d'entrée) : spikes identiques (même neurone, même pas) | **385 454 / 385 454** | **1 260 655 / 1 260 655** |
| **Stochastique** (Poisson indépendant, 5 essais) : corrélation des taux par neurone | **0,998** | **0,998** |
| Taux moyen des neurones actifs, Brian2 / TS | 43,56 / 43,56 Hz | 51,21 / 51,16 Hz |
| DN actifs identiques | oui | oui |

**Critère** (corrélation ≥ 0,95 et mêmes sorties actives) : **rempli**.

**Note sur le test stochastique** : avec des milliers de cibles, le `poi()` de Shiu crée un `PoissonInput` par neurone, et Brian2 compile chacun séparément (plusieurs heures de calcul). On utilise donc un `PoissonGroup` relié par `v += w_syn·f_poi`, sans délai et au même moment du pas de temps. C'est le même processus aléatoire (une loi de Bernoulli de paramètre p = taux × dt par pas). Avec 50 cibles ou moins (bonus FlyWire), c'est `run_trial` qui est utilisé tel quel.

**Performances** (serveur à 2 vCPU partagés, priorité basse) : 1 s simulée prend environ 7 s en TS et environ 4 s en Brian2/Cython. Il faudra optimiser en phase 4.

### 2.3 ⚠️ Sous-réseau contre cerveau entier (`06_validate_reference.py pruning`)

Même moteur TS, même stimulus, 3 essais de 1 s. Le cerveau entier compte 166 700 neurones et 25,6 M de connexions, avec la même règle de signe.

| | 30 % des entrées | 100 % des entrées |
|---|---|---|
| Corrélation des taux (neurones du sous-réseau) | 0,91 | 0,96 |
| Neurones actifs hors sous-réseau (cerveau entier) | 16 473 | 20 571 |
| DNa02 G / D, sous-réseau | 3,3 / 3,3 Hz | **25,7 / 0,0 Hz** |
| DNa02 G / D, cerveau entier | 2,7 / 0,0 Hz | **2,0 / 0,3 Hz** |
| DNa01 G / D, sous-réseau | 10,7 / 1,7 Hz | 3,0 / 0,0 Hz |
| DNa01 G / D, cerveau entier | 1,0 / 0,7 Hz | 1,0 / 0,0 Hz |

**Conclusion** : la coupe « K ≤ 5 sauts, w ≥ 11 » retire beaucoup d'inhibition qui passe par des chemins plus longs. Les DN sont alors surexcités, jusqu'à ×12, et l'asymétrie gauche/droite est amplifiée. **Le sous-réseau de la phase 1 n'est pas assez fidèle pour décider des coups.**

**Correctif proposé : sélection fondée sur l'activité.** Dans ce modèle sans activité spontanée, un neurone qui ne décharge jamais pour un stimulus donné n'a aucun effet sur les sorties, et le retirer est exact pour ce stimulus.
- Sur les deux stimuli testés, les neurones actifs dans le cerveau entier et capables d'atteindre les DN sont **41 556, avec 3,88 M de connexions** (toutes conservées). Cela tient dans le budget.
- À refaire avec les vrais stimuli du jeu (vues du plateau, phase 3).
- À valider contre le cerveau entier sur des stimuli qui n'ont pas servi à la sélection.

### 2.4 Bonus : reproduction de Shiu et al. sur FlyWire (`06_validate_reference.py flywire`, hors ligne)

Conditions :
- données de Shiu : FlyWire 630, 127 400 neurones et 14,7 M de connexions, sous licence **CC BY-NC**. Elles sont **utilisées hors ligne uniquement** (dossier `data/`, gitignoré) et ne sont **jamais déployées** ;
- stimulation : les 21 neurones gustatifs du sucre de l'hémisphère droit (liste de `example.ipynb`), avec un `PoissonInput` par neurone ;
- référence Brian2 : `run_trial` de Shiu, utilisé tel quel ;
- 5 essais de 1 s par fréquence.

| Fréquence du sucre | Corrélation des taux TS / Brian2 | MN9 G, Brian2 / TS | MN9 D, Brian2 / TS |
|---|---|---|---|
| 50 Hz | 0,995 | 18,4 / 20,8 Hz | 13,8 / 15,6 Hz |
| 100 Hz | 0,998 | 68,0 / 64,0 Hz | 48,2 / 49,2 Hz |
| 150 Hz | 0,998 | 85,0 / 86,0 Hz | 56,4 / 60,0 Hz |
| 200 Hz | 0,999 | 95,6 / 94,0 Hz | 62,4 / 60,8 Hz |

Le moteur TS reproduit le résultat central de la figure 1 de Shiu et al. : **activer les neurones du sucre recrute le motoneurone MN9 de la trompe**, dont le taux croît avec la fréquence de stimulation. Il le fait aussi bien que Brian2, aux fluctuations de Poisson près (écart-type de 2 à 6 Hz sur 5 essais).

Identifiants MN9 : `720575940660219265` (G) et `720575940645521262` (D), tirés de `figures.ipynb`.

**Sécurité du serveur** : les calculs FlyWire tournent dans un scope `systemd-run --user` avec `MemoryMax=4500M`, une fréquence par processus (`data/ref/run_flywire.sh`). Le tueur OOM ne peut donc frapper que ce calcul, pas les apps en production.

### 2.5 Nouveau sous-réseau : sélection par l'activité (`07_activity_subnetwork.py`)

**Sélection** :
- **stimuli** : 30 positions de jeu aléatoires mais légales (de 0 à 30 coups), un cap aléatoire entre −40° et +40°, et un gain de 100, 200 ou 400 Hz. Ils sont produits par le module de vision de la phase 3 (`js/stimuli.ts`) ;
- **simulation** : cerveau entier (166 700 neurones), 500 ms par stimulus ;
- **critère** : on garde les neurones qui déchargent au moins une fois **et** peuvent atteindre DNa01/DNa02 par n'importe quel chemin, plus toutes les entrées L1/L2/L3.

Neurones actifs par stimulus :

| Gain | Moyenne | Plage |
|---|---|---|
| 100 | 1 756 | 1 470 – 2 059 |
| 200 | 2 048 | 1 773 – 2 433 |
| 400 | 8 581 | 2 446 – 17 252 |

Au total, 23 444 neurones sont actifs au moins une fois, et les quatre DN en font partie.

**Résultat** :
- **26 756 neurones et 2 962 550 connexions**, contre 54 148 et 3,89 M pour la sélection par chemins ;
- 38,5 % de neurones inhibiteurs, contre 22 % : l'inhibition du cerveau central est maintenant conservée ;
- les DN gardent 52 à 63 % de leurs entrées synaptiques, mais toutes les entrées *actives* sont présentes ;
- **assets : 5,62 Mo compressés**, contre 8,89 Mo.

**Validation** sur 9 stimuli **jamais vus** pendant la sélection (3 essais de 500 ms chacun) :

| Mesure | Ancien sous-réseau (chemins) | **Nouveau (activité)** |
|---|---|---|
| Corrélation des taux avec le cerveau entier | 0,91 – 0,96 | **0,95 – 0,99 (médiane 0,98)** |
| Erreur moyenne sur les DN | jusqu'à 23 Hz (×12) | **0,24 Hz** |

## Phase 3 — Vue de la mouche

### 3.1 Direction vue par chaque colonne (`03_visual_mapping.py`)

Aucune carte œil → colonnes n'a été mesurée pour MaleCNS. Celle de Zhao et al. 2025 porte sur FAFB (une femelle) et elle est sous licence GPL-3.0. On pose donc un réseau hexagonal régulier, orienté avec l'anatomie de ce même individu :
- **axes** : h ∝ p − q et v ∝ p + q (convention de Nern et Zhao). Dans les deux médullas, l'axe postérieur suit p − q et l'axe dorsal suit p + q (régression des terminaisons de L1) ;
- **haut** : p + q élevé est dorsal. Les R7d/R8d du bord dorsal ciblent les colonnes où p + q vaut environ 64, contre 39 en moyenne ;
- **avant** : p − q élevé est antérieur dans le champ visuel. Ces colonnes sont postérieures dans la médulla, et le premier chiasma inverse l'axe avant/arrière ;
- **pas angulaire ΔΦ** : les colonnes pavent le champ visuel mesuré par Zhao et al. 2025 (élévation de −70° à +90°, azimut de −10° à 155°). On obtient **ΔΦ = 4,9°** pour les deux yeux ;
- **équateur** : il partage les colonnes en deux moitiés égales ;
- **bord frontal** : à 8° dans l'hémichamp opposé, soit un recouvrement binoculaire de 16° (Zhao : moins de 20°).

Avec un plateau à 20 cm, **260 colonnes** le voient (129 à gauche, 131 à droite). Image : `data/visual/columns.png`.

### 3.2 Spectre (`03b_spectral.py` → `vision/spectral.json`)

Chaîne de calcul :

```
couleur sRGB (vision/palette.json)
  → réflectance spectrale (Mallett & Yuksel 2019)
  × lumière du jour D65 (en photons)
  × gabarit de pigment de Govardovskii et al. 2000, aux pics in vivo de Sharkey et al. 2020
  → absorption relative au blanc, sur 380 – 780 nm
```

| Matériau | R1–6 | R7p | R7y | R8p | R8y |
|---|---|---|---|---|---|
| Plateau bleu | 0,35 | 0,22 | 0,24 | 0,44 | 0,10 |
| **Rouge** | **0,04** | 0,22 | 0,21 | 0,06 | **0,31** |
| Jaune | 0,24 | 0,48 | 0,46 | 0,13 | 0,68 |
| Fond gris clair | 0,48 | 0,48 | 0,48 | 0,48 | 0,48 |

- **Pour R1–6, le rouge est presque noir**, 5,5 fois plus sombre que le jaune.
- **R8y (Rh6, pic à 600 nm) voit encore le rouge.**
- Seuls les **R1–6** alimentent le modèle : ce sont les photorécepteurs présynaptiques à L1–L3.

### 3.3 Échantillonnage et entrée (`vision/eye.ts`)

- **Lancer de rayons** analytique sur la géométrie partagée du plateau (`vision/geometry.ts`) ;
- **acceptance gaussienne**, 61 rayons par ommatidie, avec Δρ = **7,7°** (R1–6 adaptés à la lumière, Juusola et al. 2017) ;
- **coût** : 10 à 30 ms pour 1 771 ommatidies (Node, sur ce serveur) ;
- **entrée** : taux L1/L2/L3 = gain × max(0, −contraste de Weber de R1–6 par rapport à la moyenne des deux yeux). Les cellules monopolaires répondent aux baisses de lumière.

Vue de contrôle : `data/visual/fly_view.png`. Le rouge y est sombre, le cap décale bien le plateau, et les taux sont maximaux sur les pions rouges.

### 3.4 ⚠️ Le signal atteint à peine les DN

Plateau en cours de partie, sous-réseau validé, 3 essais de 1 s :

| Plateau à 20 cm, cap 0° | 0 | 1 | 2 | 3 | 4 | 5 | 6 | DNa02 G / D |
|---|---|---|---|---|---|---|---|---|
| Gain 200 (neurones actifs par saut) | 931 | 1 417 | 137 | 114 | 45 | 5 | 1 | 0 / 0 Hz |
| Gain 400 | 932 | 2 278 | 3 959 | 9 223 | 526 | 286 | 13 | 4,7 / 1,3 Hz |
| Gain 800 | 933 | 2 634 | 4 453 | 10 182 | 567 | 302 | 13 | 1,7 / 0,3 Hz |

Sur l'ensemble des réglages essayés :
- gain de 200 à 800 ;
- plateau à 20 ou 12 cm ;
- cap de −20°, 0° ou +20° ;
- encodage sans taux de base, ou avec un taux de base tonique de 30 à 120 Hz,

**les DN ne dépassent jamais 6 Hz**, et **DNa02 G domine dans la plupart des cas**, quel que soit le côté où se trouve le plateau.

Au-delà d'un gain d'environ 400, l'inhibition recrutée fait *baisser* les DN. Le signal de virage disponible pour une décision de 1,5 s se résume donc à quelques spikes, avec un biais vers la gauche. Les options sont présentées dans le compte rendu de fin de phase 3.

## Phase 4 — Décision en boucle fermée

### 4.1 Gain de virage mesuré sur de vraies mouches (`08_calibrate_steering.py`)

**Données** : enregistrements doubles (neurone gauche + neurone droit) de Rayshubskiy et al. 2025, publiés sur Harvard Dataverse (doi:10.7910/DVN/0NCLP1, **CC0**), sommes de contrôle MD5 vérifiées. On en a 4 pour DNa02 (lignée ss730) et 2 pour DNa01 (ss731).

**Méthode** : celle de leur code d'analyse (MIT), réimplémentée parce que leur code ne fonctionne plus avec numpy 2.
- **détection des spikes** : filtre passe-haut, normalisation par l'écart absolu médian, `find_peaks` ;
- **seuil** : placé au creux à droite du mode du bruit (environ 11 à 14). Les auteurs le réglaient à l'œil pour chaque mouche ;
- **taux** : tranches de 12,5 ms lissées par une gaussienne de 25 ms ;
- **boule** : convertie en °/s avec leur calibration ;
- **ajustement** : yaw(t + décalage) = m × (taux droit − taux gauche) + b, sur les périodes où la mouche marche.

**Critère d'utilisabilité** : l'activité neuronale doit précéder la rotation (décalage ≥ 50 ms), et le signe de m ne doit pas changer quand le seuil varie de ×0,8 à ×1,25.

| Enregistrement | Pente (°/s par spike/s) | Décalage | r | Taux en marche | Utilisable |
|---|---|---|---|---|---|
| DNa02 a2_d_08 | 2,75 | 180 ms | 0,25 | 6,4 Hz | oui |
| DNa02 a2_d_12 | 3,70 | 160 ms | 0,31 | 13,6 Hz | oui |
| DNa02 a2_d_13 | 3,53 | 160 ms | 0,26 | 4,8 Hz | oui |
| DNa02 a2_d_14 | 2,78 | 150 ms | 0,25 | 7,3 Hz | oui |
| DNa01 a1_d_07 | −0,75 (le signe change avec le seuil) | 0 ms | −0,08 | 11,2 Hz | **non** |
| DNa01 a1_d_09 | 1,00 | 150 ms | 0,08 | 5,3 Hz | oui (corrélation faible) |

**Valeurs retenues** (exportées dans `src/features/fly-connect4/motor/steering-calibration.json`) :
- **kDNa02 = 3,19 °/s par spike/s**. Selon le seuil, la moyenne va de 2,96 à 3,25 ;
- **décalage de 162 ms** entre l'activité neuronale et la rotation ;
- **kDNa01 = 1,00 °/s par spike/s**, sur un seul enregistrement exploitable. Ce gain plus faible est cohérent avec les virages « lents » de DNa01 décrits dans l'article.

À noter : **les vrais DNa02 sont eux aussi peu actifs** (5 à 14 Hz en moyenne pendant la marche). Les 0 à 6 Hz du modèle sont du même ordre de grandeur.

### 4.2 Gain d'entrée (`js/gain-sweep.ts`, option 2 validée)

Conditions : 15 positions de jeu légales et aléatoires, un cap aléatoire entre −35° et +35°, boucle ouverte de 1 s. Seuls les gains de la plage validée contre le cerveau entier (≤ 400) sont testés.

| Gain | Taux moyen DNa02 | \|Droite − Gauche\| moyen | Droite − Gauche moyen | Corrélation (D − G) / position du plateau |
|---|---|---|---|---|
| 200 | 0,0 Hz | 0,0 Hz | 0,0 Hz | — |
| **300** | **1,1 Hz** | **1,7 Hz** | −1,7 Hz | **−0,58** |
| 400 | 0,7 Hz | 1,3 Hz | −1,2 Hz | −0,28 |

**Gain retenu : 300 Hz par unité de contraste OFF.**

Une corrélation négative (r = −0,58) apparaît entre l'écart droite − gauche et la position du plateau. Quand le plateau est à droite, DNa02 gauche s'active davantage et la mouche tend à se détourner. Cette tendance s'ajoute à un biais global vers la gauche. Elle est **émergente** (rien n'a été programmé dans ce sens), mais elle ne repose que sur 15 stimuli. Le benchmark de la phase 8 la mesurera mieux.

### 4.3 Boucle fermée (`motor/decide.ts`)

- **Départ** : cap initial uniforme entre −35° et +35° (graine fixée).
- **Toutes les 50 ms** :
  - nouveau rendu de la vue pour le cap courant ;
  - taux L1–L3 ;
  - simulation de la fenêtre et comptage des spikes DN ;
  - ω = 3,19 × (DNa02 D − G) + 1,00 × (DNa01 D − G), en °/s, appliqué avec un décalage de 162 ms (3 fenêtres).
- **Arrêt** : si le cap varie de moins de 1° sur 500 ms (après au moins 1 s), ou au bout de 3 s maximum.
- **Coup joué** : la colonne la plus proche du cap final. Si elle est pleine, la colonne libre la plus proche du côté où pointe le cap (règle du jeu, affichée dans l'interface).
- **État du cerveau** : remis au repos à chaque coup, le cerveau ne garde aucune mémoire entre deux coups.
- **Garanties testées** : reproductibilité à partir de la graine, cap modifié *uniquement* par les spikes DN, colonne pleine jamais jouée.

Exemples (serveur à 2 vCPU, gain 300) :

| Plateau | Graine | Cap initial → final | Colonne | Spikes DN | Simulé | Temps réel |
|---|---|---|---|---|---|---|
| vide | 1 à 6 | inchangé | celle du cap initial | 0 | 1,0 s | 2,5 à 3,6 s |
| milieu de partie | 2 | −0,8° → **−41,2°** | 0 | 17 | 2,35 s | 9,3 s |
| milieu de partie | 4 | −24,8° → −31,1° | 0 | 4 | 1,05 s | 4,1 s |
| milieu de partie | autres | inchangé | celle du cap initial | 0 à 2 | 1,0 s | 3,7 à 4,2 s |

**Conclusion** : dans la plupart des coups, aucun spike DN n'arrive, et la mouche joue la colonne vers laquelle elle regardait au départ, tirée au hasard. Quand le plateau est chargé, de vrais virages surviennent, surtout vers la gauche. **La mouche jouera donc presque au hasard, avec un biais vers la gauche.** C'est le résultat honnête du modèle publié appliqué à ce connectome.

## Phase 6 — Carte 3D du cerveau

- **Source unique** : `brain3d/recorder.ts` enregistre les spikes de chaque fenêtre de 50 ms envoyée par le Web Worker. La vue en direct lit **ces données**. Le replay au ralenti a été retiré ensuite (2026-10-28, demande du propriétaire) : après le coup, la carte garde son état final. Rien n'est animé indépendamment de la simulation.
- **Neurones** : 26 756 points placés au soma (sinon au barycentre des T-bars), colorés par superclasse. Chacun s'illumine à son spike, puis l'éclat décroît avec τ = 20 ms de temps simulé.
- **Neuropiles** : les 82 maillages MaleCNS, avec un shader fresnel. Leur couleur suit le taux de spikes de leurs neurones sur une fenêtre glissante de 50 ms (taux normalisé, puis échelle de couleurs).
- **Connexions** : à chaque spike, des particules partent vers les 3 cibles les plus fortes du neurone (calculées dans le Worker à partir du réseau simulé). Elles sont orange si la connexion est excitatrice, bleues si elle est inhibitrice. Plafond : 3 000 sur ordinateur, 600 sur mobile ; au-delà, un échantillonnage régulier limite le nombre créé à chaque image.
- **DNa01/DNa02** : marqueurs permanents et jauges gauche/droite, avec le taux sur les 200 dernières ms simulées.
- **Interactions** :
  - survol d'un neuropile : nom en français et rôle avec sa source (`brain3d/regions.ts`), sinon « rôle inconnu » ;
  - clic sur un neurone : type, superclasse, neurotransmetteur, région, bodyId, et rôle sourcé (`brain3d/cellRoles.ts`).
- **Performances** : mode allégé (pas de bloom, pixel ratio de 1, moins de particules) sur petit écran ou écran tactile. Avec `prefers-reduced-motion`, il n'y a pas de particules.

**Vérifié** dans Chromium headless (WebGL logiciel SwiftShader), sur ordinateur et sur mobile : direct, replay, infobulle, fiche neurone, aucune erreur dans la page, pas de défilement horizontal. 50 tests passent, ainsi que le lint et le build.

**Non mesuré** : la fluidité réelle (60 images/s visées). En rendu logiciel, on n'obtient qu'environ 1 image par seconde ; il faut la vérifier sur une vraie machine.

**Corrections faites en route** :
- l'export GLB n'avait pas de normales : elles sont calculées au chargement ;
- les noms des régions sont portés par les nœuds parents (gltfpack) ;
- le bloom utilise des tampons 8 bits, car les tampons en demi-flottants s'affichaient en noir sous SwiftShader ;
- le clic sur un neurone passe par une projection à l'écran, car le seuil de `Points.raycast` ignore l'échelle du groupe parent.

## Correctif (phase 7) — carte œil → espace

Le panneau « Ce que voit la mouche » a révélé un défaut de la carte de la phase 3 (§3.1). Pour placer le bord frontal de chaque rangée, j'utilisais une **médiane glissante** des colonnes les plus frontales. Or deux rangées voisines sont naturellement décalées d'une demi-colonne : la médiane reprenait la valeur d'une rangée précise, avec sa parité, ce qui effaçait ce décalage dans certaines bandes d'élévation. Résultat : des rangées alignées au lieu d'être en quinconce, des colonnes déplacées jusqu'à environ 4° en azimut, et des trous dans la couverture du champ visuel.

**Correction** : une **moyenne** glissante sur 8 rangées, qui ne reprend la parité d'aucune rangée, pour un bord frontal lisse. Le recouvrement binoculaire médian près de l'équateur vaut 17,1° (moins de 20° chez Zhao et al. 2025). 299 colonnes voient le plateau (147 à gauche, 152 à droite), contre 260 avant. Le pavage du champ visuel est désormais continu. Il reste un léger cisaillement en périphérie, inhérent au placement des rangées le long des parallèles de la sphère.

**Conséquence** : le sous-réseau (§2.5) et le gain (§4.2) avaient été choisis avec l'ancienne carte. Je les ai **revalidés** avec la nouvelle (résultats ci-dessous).

**Revalidation avec la carte corrigée** :
- **Sous-réseau contre cerveau entier**, 9 stimuli jamais vus (régénérés), 3 essais de 500 ms :
  - corrélation médiane des taux : **0,978** ;
  - corrélation du signal de virage DNa02 (D − G) : **0,83** (0,46 avec l'ancienne carte) ;
  - écart moyen sur les DN : 0,43 Hz, pour des taux moyens de 0,48 Hz.

  Le sous-réseau reste valide.
- **Balayage du gain** (mêmes 15 positions qu'en §4.2) :

| Gain | Taux moyen DNa02 | \|D − G\| moyen | D − G moyen | Corrélation (D − G) / position du plateau |
|---|---|---|---|---|
| 200 | 0,6 Hz | 0,6 Hz | −0,6 Hz | −0,60 |
| 300 | 0,7 Hz | 1,13 Hz | −1,13 Hz | −0,62 |
| **400** | **1,1 Hz** | **1,27 Hz** | −0,87 Hz | −0,45 |

  Avec le même critère (maximiser le signal DNa02), **le gain passe à 400**. Le biais vers la gauche et la tendance à se détourner du plateau persistent.

Anciens résultats conservés dans `data/activity/old_mapping/`.

## Phase 8 — Benchmark : le niveau de la mouche

### Méthode

- **Script** : `js/benchmark.ts`, exécuté dans Node. Il utilise exactement le même code que la page : `decide()`, les assets `public/fly-brain/v1`, et les graines de coup `moveSeed(gameSeed, n)`. Le gain d'entrée est de 400.
- **Adversaires** :
  - joueur aléatoire (coup légal uniforme, avec graine) ;
  - minimax alpha-bêta de profondeur 1, 3 et 5 (`game/opponents.ts`), avec une heuristique à fenêtres de 4 cases et une préférence pour le centre. Les égalités sont départagées au hasard (avec graine).
- **Volume** : 200 parties par condition. La mouche joue en premier dans les parties paires, en second dans les impaires.
- **Contrôles** (200 parties chacun, contre le joueur aléatoire) :
  - **DNa02 silencés** : leur sortie, c'est-à-dire la commande de virage, est coupée ;
  - **couleurs des pions inversées dans la vision de la mouche** : les règles du jeu sont inchangées.
- **Ligne de base « hasard »** : un joueur aléatoire prend la place de la mouche, 1 000 parties contre chaque adversaire (`--player random`).
- **Statistiques** (`09_benchmark_report.py`) :
  - victoires, nuls et défaites, avec intervalles de confiance de Wilson à 95 % ;
  - « mieux que le hasard ? » : χ² sur le tableau 2 × 3 (mouche contre hasard ; victoires, nuls, défaites) et test exact de Fisher unilatéral sur les victoires ;
  - préférence de colonnes : χ² d'ajustement entre les colonnes jouées et celles que donnerait un coup légal uniforme dans les mêmes positions.
- **Exécution** : 2 processus en `nice 19`, résultats en JSONL ligne par ligne, reprise automatique (`js/run-benchmark.sh`). Démarrage le 2026-10-27 à 11 h 06 UTC. Environ 20 à 27 h de calcul sur 2 vCPU : la simulation de chaque coup est le facteur limitant (84 % des 26 756 neurones restent actifs pendant une décision).

### Résultats (1 200 parties, terminé le 2026-10-28 à 02 h 12 UTC)

Fichiers : `data/bench/summary.json` (complet) et `src/features/fly-connect4/ui/benchmark.json` (affiché par la page).

| Adversaire | Parties | V / N / D mouche | Victoires mouche (IC 95 %) | Victoires du hasard (1 000 parties) | χ² mouche vs hasard | Fisher unilatéral |
|---|---|---|---|---|---|---|
| aléatoire | 200 | 92 / 1 / 107 | 46 % (39–53 %) | 47,1 % | p = 0,87 | p = 0,64 |
| minimax 1 | 200 | 1 / 0 / 199 | 0,5 % | 0,5 % | p = 1,0 | p = 0,67 |
| minimax 3 | 200 | 1 / 0 / 199 | 0,5 % | 0,6 % | p = 1,0 | p = 0,72 |
| minimax 5 | 200 | 0 / 0 / 200 | 0 % | 0 % | p = 1,0 | p = 1,0 |

**Niveau** : la mouche n'est pas meilleure que le hasard, contre aucun adversaire. Contre le joueur aléatoire, elle gagne 58 parties sur 100 en commençant et 34 sur 100 en second (hasard : 50 et 44).

**Où elle joue** (contre le joueur aléatoire, 2 076 coups) :

| Colonne | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Mouche (%) | 25,5 | 15,1 | 14,2 | 11,6 | 10,3 | 10,9 | 12,4 |
| Hasard dans les mêmes positions (%) | 13,1 | 14,2 | 14,2 | 14,6 | 14,8 | 14,5 | 14,7 |

χ² d'ajustement : p < 10⁻⁶. 62 % des coups sont à gauche du centre (hasard : 48,6 %). La colonne 1 est jouée deux fois plus souvent que par hasard. En moyenne, 4,65 spikes DN par coup. Le cap a changé d'au moins 0,5° dans 57 % des coups. La règle de la colonne pleine s'est appliquée dans 4,4 % des coups. Le même biais apparaît contre les trois minimax (55 à 57 % à gauche, colonne 1 à environ 23 %).

**Contrôles** (contre le joueur aléatoire, 200 parties chacun) :

| Contrôle | V / N / D | χ² vs mouche normale | Colonnes vs hasard (χ² ajust.) | Coups à gauche | Spikes DN par coup | Coups avec virage |
|---|---|---|---|---|---|---|
| mouche normale | 92 / 1 / 107 | — | p < 10⁻⁶ | 62,0 % | 4,65 | 57 % |
| DNa02 silencés | 104 / 1 / 95 | p = 0,48 | **p = 0,59** | 50,5 % | 0,44 | 22 % |
| couleurs inversées | 98 / 1 / 101 | p = 0,83 | p < 10⁻⁶ | 60,9 % | 4,31 | 55 % |

**Interprétation** :

1. Le biais vers la gauche vient bien des DNa02 simulés. Quand on les silence, la distribution des colonnes devient indiscernable du hasard (p = 0,59). Les virages qui restent (22 % des coups) viennent des DNa01, avec 0,44 spike par coup.
2. Ce biais ne rapporte rien : le taux de victoire ne change pas quand on le supprime (p = 0,48).
3. Inverser les couleurs des pions ne change ni les résultats ni les colonnes jouées. La mouche simulée ne distingue donc pas ses pions de ceux de l'adversaire, ou du moins cette distinction n'atteint pas la décision.
4. Conclusion : dans ce modèle, l'image du plateau atteint les neurones de virage, puisque le biais disparaît avec DNa02. Mais le signal qui arrive ne porte pas d'information utile au jeu. C'est un résultat du modèle (connectome + LIF de Shiu + entrée L1–L3), pas une affirmation sur une vraie mouche.
