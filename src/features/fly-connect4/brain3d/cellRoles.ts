// Known roles of some cell types (neuPrint type names), each with a reference.
// Any other type: "rôle inconnu".

import type { SourceKey } from "./sources";

interface Rule {
  test: RegExp;
  role: string;
  source: SourceKey;
}

const RULES: Rule[] = [
  { test: /^DNa02$/, role: "Neurone descendant de virage rapide (« gain fort ») ; sa différence droite − gauche prédit la rotation.", source: "rayshubskiy2025" },
  { test: /^DNa01$/, role: "Neurone descendant de virage lent et soutenu (« gain faible »).", source: "rayshubskiy2025" },
  { test: /^L[123]$/, role: "Cellule monopolaire de la lamina : relaie les variations de lumière des photorécepteurs R1–R6.", source: "clark2011" },
  { test: /^(Mi1|Tm3)$/, role: "Entrée de T4 : voie ON (bords clairs) de la détection du mouvement.", source: "behnia2014" },
  { test: /^(Tm1|Tm2|Tm4|Tm9)$/, role: "Entrée de T5 : voie OFF (bords sombres) de la détection du mouvement.", source: "behnia2014" },
  { test: /^T4[a-d]$/, role: "Détecteur élémentaire du mouvement des bords clairs, sélectif à une direction.", source: "maisak2013" },
  { test: /^T5[a-d]$/, role: "Détecteur élémentaire du mouvement des bords sombres, sélectif à une direction.", source: "maisak2013" },
  { test: /^LPLC2$/, role: "Détecteur d'objets qui approchent (looming).", source: "klapoetke2017" },
  { test: /^LC\d+/, role: "Neurone de projection de la lobula : détecteur de traits visuels, projette vers un glomérule optique.", source: "wu2016" },
  { test: /^(HS[ENS]|VS\d*)$/, role: "Neurone tangentiel de la plaque lobulaire : mouvement à grand champ.", source: "borst2010" },
];

export function cellRole(type: string): { role: string | null; source: SourceKey | null } {
  const r = RULES.find((x) => x.test.test(type));
  return r ? { role: r.role, source: r.source } : { role: null, source: null };
}
