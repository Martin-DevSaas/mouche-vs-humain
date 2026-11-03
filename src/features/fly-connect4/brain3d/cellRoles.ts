// Known roles of some cell types (neuPrint type names), each with a reference, in French, English and Spanish.
// Any other type: "role unknown".

import type { FlyLang } from "../ui/i18n";
import type { SourceKey } from "./sources";

interface Rule {
  test: RegExp;
  role: Record<FlyLang, string>;
  source: SourceKey;
}

const RULES: Rule[] = [
  {
    test: /^DNa02$/,
    role: {
      fr: "Neurone descendant de virage rapide (« gain fort ») ; sa différence droite − gauche prédit la rotation.",
      en: "Descending neuron for fast turns (“high gain”); its right − left difference predicts rotation.",
      es: "Neurona descendente de giro rápido («ganancia alta»); su diferencia derecha − izquierda predice la rotación.",
    },
    source: "rayshubskiy2025",
  },
  {
    test: /^DNa01$/,
    role: {
      fr: "Neurone descendant de virage lent et soutenu (« gain faible »).",
      en: "Descending neuron for slow, sustained turns (“low gain”).",
      es: "Neurona descendente de giro lento y sostenido («ganancia baja»).",
    },
    source: "rayshubskiy2025",
  },
  {
    test: /^L[123]$/,
    role: {
      fr: "Cellule monopolaire de la lamina : relaie les variations de lumière des photorécepteurs R1–R6.",
      en: "Lamina monopolar cell: relays light changes from photoreceptors R1–R6.",
      es: "Célula monopolar de la lámina: transmite los cambios de luz de los fotorreceptores R1–R6.",
    },
    source: "clark2011",
  },
  {
    test: /^(Mi1|Tm3)$/,
    role: {
      fr: "Entrée de T4 : voie ON (bords clairs) de la détection du mouvement.",
      en: "Input to T4: ON pathway (bright edges) of motion detection.",
      es: "Entrada de T4: vía ON (bordes claros) de la detección del movimiento.",
    },
    source: "behnia2014",
  },
  {
    test: /^(Tm1|Tm2|Tm4|Tm9)$/,
    role: {
      fr: "Entrée de T5 : voie OFF (bords sombres) de la détection du mouvement.",
      en: "Input to T5: OFF pathway (dark edges) of motion detection.",
      es: "Entrada de T5: vía OFF (bordes oscuros) de la detección del movimiento.",
    },
    source: "behnia2014",
  },
  {
    test: /^T4[a-d]$/,
    role: {
      fr: "Détecteur élémentaire du mouvement des bords clairs, sélectif à une direction.",
      en: "Elementary motion detector for bright edges, tuned to one direction.",
      es: "Detector elemental del movimiento de bordes claros, selectivo a una dirección.",
    },
    source: "maisak2013",
  },
  {
    test: /^T5[a-d]$/,
    role: {
      fr: "Détecteur élémentaire du mouvement des bords sombres, sélectif à une direction.",
      en: "Elementary motion detector for dark edges, tuned to one direction.",
      es: "Detector elemental del movimiento de bordes oscuros, selectivo a una dirección.",
    },
    source: "maisak2013",
  },
  {
    test: /^LPLC2$/,
    role: {
      fr: "Détecteur d'objets qui approchent (looming).",
      en: "Detector of approaching objects (looming).",
      es: "Detector de objetos que se acercan (looming).",
    },
    source: "klapoetke2017",
  },
  {
    test: /^LC\d+/,
    role: {
      fr: "Neurone de projection de la lobula : détecteur de traits visuels, projette vers un glomérule optique.",
      en: "Lobula projection neuron: visual feature detector, projects to an optic glomerulus.",
      es: "Neurona de proyección de la lóbula: detector de rasgos visuales, proyecta hacia un glomérulo óptico.",
    },
    source: "wu2016",
  },
  {
    test: /^(HS[ENS]|VS\d*)$/,
    role: {
      fr: "Neurone tangentiel de la plaque lobulaire : mouvement à grand champ.",
      en: "Lobula plate tangential neuron: wide-field motion.",
      es: "Neurona tangencial de la placa lobular: movimiento de campo amplio.",
    },
    source: "borst2010",
  },
];

export function cellRole(type: string, lang: FlyLang = "fr"): { role: string | null; source: SourceKey | null } {
  const r = RULES.find((x) => x.test.test(type));
  return r ? { role: r.role[lang], source: r.source } : { role: null, source: null };
}
