# Notes scientifiques — « Mouche vs Humain »

Une ligne par point. **Réel** = mesuré dans les données. **Modèle publié** = repris d'un article. **Simplification** = choix fait pour ce projet.
Ce fichier est complété à chaque phase. Le panneau « Ce qui est réel / ce qui est simplifié » de la page en est le résumé.

## Données (phase 1)

| Point | Statut | Détail et source |
|---|---|---|
| Câblage neurone → neurone | Réel | MaleCNS v1.0, un seul mâle, FIB-SEM à 8 nm. Berg et al., *Cell* 2026, doi:10.1016/j.cell.2026.08.015. CC-BY 4.0 |
| Nombre de neurones (166 700) | Réel | Corps annotés avec une `superclass` dans `body-annotations-…-minconf-0.5` |
| Poids = nombre de synapses | Réel | Table `connectome-weights-…-minconf-0.5` (confiance des synapses ≥ 0,5) |
| Neurotransmetteur de chaque neurone | Prédiction publiée | Réseau de neurones appliqué aux T-bars, fourni avec MaleCNS (`tbar-neurotransmitters`) |
| Signe excitateur / inhibiteur | Modèle publié + simplification | Règle de Shiu et al. 2024 : inhibiteur si plus de 50 % des sites sont GABA ou glutamate. **Ajout** : l'histamine compte aussi comme inhibitrice (canaux chlore HisCl1/ort), alors qu'elle est absente des données de Shiu. Cela change le signe de 63 neurones |
| Dopamine, sérotonine, octopamine | Modèle publié | Comptées comme excitatrices, comme chez Shiu. Ce sont des neuromodulateurs, donc c'est une approximation reconnue par les auteurs |
| ~~Sous-réseau de 54 148 neurones~~ (phase 1, remplacé en phase 3) | Simplification abandonnée | Chemins L1/L2/L3 → DNa01/DNa02 d'au plus 5 sauts, en ne cherchant que via les connexions ≥ 11 synapses. On garde 17 % des synapses du cerveau et 89–92 % des entrées des DN. Voir `tools/fly-connectome/REPORT.md` |
| Entrées = L1, L2, L3 | Simplification | Les photorécepteurs sont incomplets dans le jeu de données (6 091 sur ~14 000) et n'ont pas de colonne. Les L1–L3 sont leurs cibles directes dans la lamina |
| Colonnes des L3 gauches | Simplification validée | Absentes de la v1.0. Déduites par vote synaptique des partenaires (99,9 % de colonnes exactes sur les entrées dont la colonne est connue) |
| Position 3D des neurones | Réel / approximation | Soma s'il est connu (47 533 neurones), sinon barycentre des T-bars du neurone |
| Maillages des neuropiles | Réel, décimé | ROI MaleCNS `roisSmoothedDecimated`, réduites à environ 5 % des triangles |
| Asymétrie gauche/droite du sous-réseau | Réel, amplifié par la sélection | Le lobe optique droit (relu plus en détail) a des poids 5 à 10 % plus élevés. Avec un seuil fixe, plus de neurones droits sont retenus (26 614 contre 21 247). Effet sur les virages mesuré en phase 2 |

## Simulation (phase 2)

| Point | Statut | Détail et source |
|---|---|---|
| Modèle de neurone (LIF, synapse exponentielle, période réfractaire, délai) | Modèle publié | Shiu et al. 2024, `model.py` (commit 91bdd1e), paramètres identiques. Portage en TypeScript validé spike par spike contre Brian2 (100 % de spikes identiques, corrélation des taux 0,998) |
| Événements perdus pendant la période réfractaire | Modèle publié | Comportement réel de Brian2 (`unless refractory` = écriture conditionnelle sur v et g), reproduit à l'identique |
| Moteur vérifié sur un résultat publié | Validation | Hors ligne, sur les données FlyWire de Shiu : neurones du sucre → MN9 reproduit (taux croissant de 18 à 95 Hz, identique à Brian2). FlyWire n'est jamais déployé (CC BY-NC) |
| Poids = nombre de synapses × 0,275 mV | Modèle publié | Paramètre libre de Shiu, calé sur FlyWire. **Non recalé** sur MaleCNS |
| Neurones sans activité spontanée, tous traités comme des neurones à spikes | Simplification du modèle publié | Les photorécepteurs, les L1–L3 et beaucoup de neurones du lobe optique fonctionnent en potentiels gradués, sans spikes. Shiu et al. le reconnaissent comme une limite |
| Entrées de Poisson (68,75 mV par événement, un spike garanti) | Modèle publié | Mécanisme de stimulation de Shiu (`f_poi = 250`) |
| ~~Sous-réseau de 54 148 neurones (sélection par chemins courts)~~ | **Remplacé** | Comparé au cerveau entier, il surexcite les DN (jusqu'à ×12) et amplifie l'asymétrie gauche/droite. Il sera remplacé par une sélection fondée sur l'activité (voir `REPORT.md` §2.3) |

| Sous-réseau de 26 756 neurones (sélection par l'activité) | Simplification validée | Neurones qui déchargent dans le cerveau entier pour 30 stimuli de jeu et qui peuvent atteindre les DN. Sur 9 stimuli jamais vus : corrélation des taux 0,98 et 0,24 Hz d'écart sur les DN par rapport au cerveau entier |

## Vision (phase 3)

| Point | Statut | Détail et source |
|---|---|---|
| Une ommatidie par colonne optique de ce mâle (879 G, 892 D) | Réel | Coordonnées hexagonales MaleCNS (Nern et al. 2025). FlyGym utilise 721 ommatidies par œil, Zhao et al. comptent environ 750 chez leurs femelles |
| Direction vue par chaque colonne | **Simplification** | Pas de carte œil → colonnes mesurée pour MaleCNS. Réseau hexagonal régulier (ΔΦ = 4,9°), orienté avec l'anatomie de ce mâle (axe dorsal via R7d/R8d, axe avant via la médulla et le chiasma), et calé sur le champ visuel mesuré par Zhao et al. 2025. Les bords latéraux sont approximatifs, la zone frontale où se trouve le plateau est la plus fiable. Correction en phase 7 : bord frontal lissé par une moyenne (et non une médiane), qui préserve la disposition en quinconce des rangées (voir `REPORT.md`) |
| Acceptance gaussienne Δρ = 7,7° | Valeur publiée | Moyenne des R1–6 adaptés à la lumière (Juusola et al. 2017). Le rétrécissement dû aux micro-saccades (environ 4°) n'est pas modélisé |
| Sensibilités spectrales | Valeurs publiées + gabarit | Pics mesurés in vivo par Sharkey et al. 2020, forme des courbes selon le gabarit de Govardovskii et al. 2000. L'élargissement de Rh6 dû au pigment d'écran est seulement approché par son pic à 600 nm |
| Couleurs → réflectances | **Simplification** | Les plastiques sont décrits par leur couleur sRGB, convertie en spectre (Mallett & Yuksel 2019) sous lumière du jour D65. Leur réflectance UV est inconnue (intégration sur 380–780 nm), donc les canaux R7 ne sont qu'indicatifs |
| Seuls R1–6 alimentent le modèle | Réel (anatomie) | R1–6 sont les photorécepteurs présynaptiques à L1–L3. R7/R8 (vers la médulla) sont calculés pour le panneau mais n'entrent pas dans le modèle (incomplets et sans colonnes dans le jeu de données) |
| L1/L2/L3 codent les baisses de lumière | Modèle publié + simplification | Les cellules monopolaires se dépolarisent quand la lumière baisse (Laughlin 1981 ; Clark et al. 2011). Ici, taux de Poisson = gain × max(0, −contraste). Les trois types reçoivent le même taux, et leurs dynamiques propres (transitoire ou soutenue) sont ignorées |
| Scène : plateau à 20 cm devant un fond gris clair, mouche à mi-hauteur. Le plateau 3D affiché utilise exactement ces dimensions et couleurs (`vision/geometry.ts`, `vision/palette.json`), avec le même fond gris | Choix de mise en scène | Le plateau couvre environ ±34° × ±31°, soit 260 colonnes. Le pion « fantôme » qui suit le cap pendant la réflexion n'est **pas** vu par la mouche |
| Le signal visuel atteint à peine DNa01/DNa02 (0 à 6 Hz), avec un biais vers DNa02 G | **Résultat du modèle** | Mesuré, pas corrigé. Voir `tools/fly-connectome/REPORT.md` §3.4 |

## Plateau (phase 5)

| Point | Statut | Détail et source |
|---|---|---|
| La géométrie et les couleurs du plateau 3D sont celles que voit la mouche | Cohérence vérifiée | Une seule source pour les deux (`vision/geometry.ts`, `palette.json`). Les pieds, déplacés à l'extérieur des montants en phase 5, sont aussi vus ainsi par la mouche. Ce petit changement est postérieur à la sélection du sous-réseau et au choix du gain, et il ne concerne que les bords du plateau |
| Physique de chute (gravité 981 cm/s², rebond amorti avec un coefficient de 0,22) | Simplification | Animation seulement, sans effet sur le jeu ni sur la simulation |
| Son « clac » synthétisé (WebAudio) | Choix de mise en scène | Bruit filtré et résonance brève, aucun fichier audio |

## Carte du cerveau (phase 6)

| Point | Statut | Détail et source |
|---|---|---|
| Activité affichée = spikes simulés | Réel (dans le modèle) | La vue en direct lit l'enregistrement des spikes de la simulation, puis garde l'état final jusqu'au coup suivant (pas de replay). Aucune animation décorative |
| Position des neurones | Réel / approximation | Soma s'il est connu, sinon barycentre des T-bars (les arborisations ne sont pas dessinées) |
| Particules le long des 3 connexions les plus fortes | Simplification visuelle | Elles montrent une partie seulement de la propagation réelle, qui passe par toutes les connexions. Leur vitesse est choisie pour la lisibilité ; le délai simulé, lui, est de 1,8 ms |
| Couleur des neuropiles | Mesure normalisée | Taux moyen de spikes de leurs neurones sur 50 ms simulées, normalisé de façon non linéaire (1 − e^(−taux/15 Hz)) |
| Rôles des neuropiles et des types de neurones | Sources citées | Une référence par rôle (`brain3d/sources.ts`), sinon « rôle inconnu ». Noms d'après la nomenclature d'Ito et al. 2014 |

## Page (phase 7)

| Point | Statut | Détail et source |
|---|---|---|
| Mode labo (silençage) | Modèle publié | Comme Shiu et al. : les synapses de sortie des neurones choisis sont mises à zéro. Pour DNa01/DNa02, cela retire aussi leurs spikes de la commande de virage, puisque cette commande est leur sortie |
| « Pourquoi elle a joué ici » | Description, pas explication causale | Nombre de spikes par type et par étage (distance aux entrées) pendant la réflexion. L'interface rappelle qu'activité ne veut pas dire causalité |
| « Ce que voit la mouche » | Calcul du modèle | La même fonction que l'entrée de la simulation (`sampleOmmatidia`), pour le cap affiché |

## Benchmark (phase 8)

| Point | Statut | Détail et source |
|---|---|---|
| Niveau de la mouche | Mesuré | 200 parties par adversaire (aléatoire, minimax 1, 3, 5), moitié en premier, moitié en second, avec exactement le même code que la page |
| « Mieux que le hasard ? » | Test statistique | Comparaison avec un joueur aléatoire placé dans les mêmes conditions (χ² et test de Fisher) |
| Contrôles | Mesuré | DNa02 silencés (plus de commande de virage rapide) et couleurs des pions inversées dans la vision |
| Adversaires minimax | Choix d'implémentation | Heuristique classique à fenêtres de 4 cases. Ce ne sont pas des joueurs « parfaits », seulement des niveaux croissants |
| Résultat : niveau | **Mesuré** | Aucune différence avec le hasard : 92 V / 1 N / 107 D contre le joueur aléatoire (hasard : 47 % de victoires, p = 0,87). 1, 1 et 0 victoire sur 200 contre minimax 1, 3 et 5 |
| Résultat : colonnes | **Mesuré** | Biais vers la gauche : 62 % des coups (hasard : 49 %), colonne 1 jouée deux fois plus souvent (p < 10⁻⁶). Le biais disparaît quand les DNa02 sont silencés (p = 0,59 contre le hasard) |
| Résultat : couleurs inversées | **Mesuré** | Aucun effet (p = 0,83) : la décision ne dépend pas de la couleur des pions |
| Score cumulé des humains | Non implémenté | Choix du propriétaire du projet : il faudrait un stockage côté serveur |

## Décision (phase 4)

| Point | Statut | Détail et source |
|---|---|---|
| Le coup ne dépend que de DNa01/DNa02 simulés | Réel (dans le modèle) | Le cap ne change que par les spikes DN (vérifié par un test). Aucune heuristique ni recherche de coup |
| Vitesse de rotation = k × (droite − gauche), virage ipsilatéral | Modèle publié | Rayshubskiy et al. 2025 : relation linéaire avec la différence droite − gauche de DNa02 |
| kDNa02 = 3,19 °/s par spike/s, décalage de 162 ms | **Mesuré** sur des données réelles | 4 enregistrements doubles de DNa02 (Dataverse, CC0), méthode des auteurs réimplémentée (`08_calibrate_steering.py`) |
| kDNa01 = 1,00 °/s par spike/s | Mesuré, peu fiable | Un seul enregistrement exploitable, corrélation faible. Les spikes de DNa01 sont difficiles à détecter (les auteurs le signalent) |
| Données de marche (Rayshubskiy) appliquées à un choix de cap | **Simplification** | Les enregistrements sont faits sur boule, en marche. La fixation de barres est décrite en vol (Reichardt, Maimon). On transpose la relation DN → rotation |
| Gain d'entrée de 400 Hz par unité de contraste | Paramètre global choisi | Celui qui maximise le signal DNa02 parmi 200, 300 et 400 (plage validée contre le cerveau entier). C'était 300 avec l'ancienne carte œil → espace, avant la correction de la phase 7 |
| Cap initial aléatoire entre −35° et +35°, arrêt après stabilisation (1° sur 500 ms, au moins 1 s) ou au bout de 3 s | Choix de protocole | Inspiré des arènes de vol en boucle fermée. La graine est affichée et chaque partie peut être rejouée |
| Cerveau remis au repos à chaque coup | Simplification | Aucune mémoire entre les coups |
| Colonne pleine → colonne libre la plus proche dans la direction du cap | Règle du jeu | Seule exception autorisée, affichée dans l'interface quand elle s'applique |
| La mouche joue au niveau du hasard, avec un biais vers la gauche | **Résultat du modèle** | Les virages, quand il y en a, vont surtout à gauche. Le biais est causé par DNa02 (il disparaît quand on les silence) mais n'améliore pas le jeu. Voir `REPORT.md` §4 et §8 |

## Références

- Berg S. et al. Sexual dimorphism in the complete connectome of the *Drosophila* male central nervous system. *Cell* 189, 5504–5526 (2026). doi:10.1016/j.cell.2026.08.015
- Shiu P.K. et al. A *Drosophila* computational brain model reveals sensorimotor processing. *Nature* 634, 210–219 (2024). doi:10.1038/s41586-024-07763-9. Code : github.com/philshiu/Drosophila_brain_model (MIT)
- Rayshubskiy A. et al. Neural circuit mechanisms for steering control in walking *Drosophila*. *eLife* (2025). doi:10.7554/eLife.102230. Données : Harvard Dataverse doi:10.7910/DVN/0NCLP1 (CC0)
- Nern A. et al. Connectome-driven neural inventory of a complete visual system. *Nature* 641 (2025). doi:10.1038/s41586-025-08746-0
- Sharkey C.R. et al. The spectral sensitivity of *Drosophila* photoreceptors. *Sci Rep* 10, 18242 (2020)
- Ito K. et al. A systematic nomenclature for the insect brain. *Neuron* 81, 755–765 (2014)
- Les références des rôles affichés dans la carte sont listées dans `src/features/fly-connect4/brain3d/sources.ts`
- Zhao A. et al. Eye structure shapes neuron function in *Drosophila* motion vision. *Nature* 646, 135–142 (2025). doi:10.1038/s41586-025-09276-5
- Juusola M. et al. Microsaccadic sampling of moving image information provides *Drosophila* hyperacute vision. *eLife* 6, e26117 (2017)
- Gonzalez-Bellido P.T., Wardill T.J., Juusola M. Compound eyes and retinal information processing in miniature dipteran species match their specific ecological demands. *PNAS* 108, 4224–4229 (2011)
- Govardovskii V.I. et al. In search of the visual pigment template. *Vis Neurosci* 17, 509–528 (2000)
- Mallett I., Yuksel C. Spectral primary decomposition for rendering with sRGB reflectance. *EGSR* (2019)
- Wang-Chen S. et al. NeuroMechFly v2. *Nature Methods* 21 (2024). doi:10.1038/s41592-024-02497-y
