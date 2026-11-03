// Names (Ito et al. 2014 nomenclature) and sourced roles of the neuropils, in French, English and Spanish.
// Rule: a role is shown only with a reference; otherwise "role unknown".

import type { FlyLang } from "../ui/i18n";
import type { SourceKey } from "./sources";

type L3 = Record<FlyLang, string>;

export interface RegionInfo {
  name: string;
  role: string | null;
  source: SourceKey | null;
}

interface Region {
  name: L3;
  role: L3 | null;
  source: SourceKey | null;
}

const l3 = (fr: string, en: string, es: string): L3 => ({ fr, en, es });
const known = (name: L3, role: L3, source: SourceKey): Region => ({ name, role, source });
const unknown = (fr: string, en: string, es: string): Region => ({ name: l3(fr, en, es), role: null, source: null });

const MB_ROLE = l3(
  "Corps pédonculé : mémoire associative.",
  "Mushroom body: associative memory.",
  "Cuerpo pedunculado: memoria asociativa.",
);
const LC_GLOMERULI = l3(
  "Contient des glomérules optiques recevant les neurones LC.",
  "Contains optic glomeruli that receive LC neurons.",
  "Contiene glomérulos ópticos que reciben las neuronas LC.",
);
const DN_RICH = l3(
  "Région riche en neurones descendants (mouvements du corps et de la tête).",
  "Region rich in descending neurons (body and head movements).",
  "Región rica en neuronas descendentes (movimientos del cuerpo y de la cabeza).",
);

const REGIONS: Record<string, Region> = {
  LA: known(
    l3("Lamina", "Lamina", "Lámina"),
    l3(
      "Premier relais visuel : reçoit les photorécepteurs R1–R6 de chaque ommatidie.",
      "First visual relay: receives photoreceptors R1–R6 from each ommatidium.",
      "Primer relevo visual: recibe los fotorreceptores R1–R6 de cada omatidio.",
    ),
    "nern2025",
  ),
  ME: known(
    l3("Médulla", "Medulla", "Médula"),
    l3(
      "Traitement visuel colonne par colonne (contraste, couleur, premières étapes du calcul du mouvement).",
      "Column-by-column visual processing (contrast, colour, first steps of motion computation).",
      "Procesamiento visual columna por columna (contraste, color, primeros pasos del cálculo del movimiento).",
    ),
    "nern2025",
  ),
  AME: unknown("Médulla accessoire", "Accessory medulla", "Médula accesoria"),
  LO: known(
    l3("Lobula", "Lobula", "Lóbula"),
    l3(
      "Détection de traits visuels ; ses neurones LC projettent vers les glomérules optiques.",
      "Visual feature detection; its LC neurons project to the optic glomeruli.",
      "Detección de rasgos visuales; sus neuronas LC proyectan hacia los glomérulos ópticos.",
    ),
    "wu2016",
  ),
  LOP: known(
    l3("Plaque lobulaire", "Lobula plate", "Placa lobular"),
    l3(
      "Mouvement visuel à grand champ, par direction (neurones T4/T5, HS/VS).",
      "Wide-field visual motion, by direction (T4/T5, HS/VS neurons).",
      "Movimiento visual de campo amplio, por dirección (neuronas T4/T5, HS/VS).",
    ),
    "borst2010",
  ),
  AOTU: known(
    l3("Tubercule optique antérieur", "Anterior optic tubercle", "Tubérculo óptico anterior"),
    l3(
      "Relais d'information visuelle vers le complexe central.",
      "Relays visual information to the central complex.",
      "Relevo de información visual hacia el complejo central.",
    ),
    "omoto2017",
  ),
  BU: known(
    l3("Bulbe", "Bulb", "Bulbo"),
    l3(
      "Relais visuel entre le tubercule optique et le corps ellipsoïde.",
      "Visual relay between the optic tubercle and the ellipsoid body.",
      "Relevo visual entre el tubérculo óptico y el cuerpo elipsoide.",
    ),
    "omoto2017",
  ),
  PVLP: known(
    l3(
      "Protocérébrum ventrolatéral postérieur",
      "Posterior ventrolateral protocerebrum",
      "Protocerebro ventrolateral posterior",
    ),
    l3(
      "Contient des glomérules optiques recevant les neurones LC (objets, approche).",
      "Contains optic glomeruli that receive LC neurons (objects, looming).",
      "Contiene glomérulos ópticos que reciben las neuronas LC (objetos, aproximación).",
    ),
    "wu2016",
  ),
  PLP: known(
    l3("Protocérébrum latéral postérieur", "Posterior lateral protocerebrum", "Protocerebro lateral posterior"),
    LC_GLOMERULI,
    "wu2016",
  ),
  AVLP: unknown(
    "Protocérébrum ventrolatéral antérieur",
    "Anterior ventrolateral protocerebrum",
    "Protocerebro ventrolateral anterior",
  ),
  EB: known(
    l3("Corps ellipsoïde", "Ellipsoid body", "Cuerpo elipsoide"),
    l3(
      "Boussole interne : l'activité y code le cap de la mouche.",
      "Internal compass: its activity encodes the fly's heading.",
      "Brújula interna: su actividad codifica el rumbo de la mosca.",
    ),
    "seelig2015",
  ),
  PB: known(
    l3("Pont protocérébral", "Protocerebral bridge", "Puente protocerebral"),
    l3(
      "Représentation du cap, en lien avec le corps ellipsoïde.",
      "Heading representation, linked to the ellipsoid body.",
      "Representación del rumbo, en relación con el cuerpo elipsoide.",
    ),
    "hulse2021",
  ),
  FB: known(
    l3("Corps en éventail", "Fan-shaped body", "Cuerpo en abanico"),
    l3(
      "Navigation : intègre le cap et des signaux internes pour orienter le comportement.",
      "Navigation: combines heading and internal signals to steer behaviour.",
      "Navegación: integra el rumbo y señales internas para orientar el comportamiento.",
    ),
    "hulse2021",
  ),
  NO: known(
    l3("Noduli", "Noduli", "Nódulos"),
    l3(
      "Reçoivent des signaux de mouvement propre utilisés pour la navigation.",
      "Receive self-motion signals used for navigation.",
      "Reciben señales de movimiento propio usadas para la navegación.",
    ),
    "hulse2021",
  ),
  AB: unknown("Corps asymétrique", "Asymmetrical body", "Cuerpo asimétrico"),
  LAL: known(
    l3("Lobe accessoire latéral", "Lateral accessory lobe", "Lóbulo accesorio lateral"),
    l3(
      "Relie le complexe central aux neurones descendants ; contrôle des virages.",
      "Links the central complex to descending neurons; steering control.",
      "Conecta el complejo central con las neuronas descendentes; control de los giros.",
    ),
    "namiki2018",
  ),
  SPS: known(l3("Pente postérieure supérieure", "Superior posterior slope", "Pendiente posterior superior"), DN_RICH, "namiki2018"),
  IPS: known(l3("Pente postérieure inférieure", "Inferior posterior slope", "Pendiente posterior inferior"), DN_RICH, "namiki2018"),
  VES: known(
    l3("Veste", "Vest", "Chaleco"),
    l3("Région riche en neurones descendants.", "Region rich in descending neurons.", "Región rica en neuronas descendentes."),
    "namiki2018",
  ),
  GNG: known(
    l3("Ganglions gnathaux", "Gnathal ganglia", "Ganglios gnatales"),
    l3(
      "Goût et commande de la trompe ; nombreux neurones descendants.",
      "Taste and proboscis control; many descending neurons.",
      "Gusto y control de la probóscide; muchas neuronas descendentes.",
    ),
    "shiu2024",
  ),
  AL: known(
    l3("Lobe antennaire", "Antennal lobe", "Lóbulo antenal"),
    l3("Premier relais de l'odorat.", "First relay of smell.", "Primer relevo del olfato."),
    "vosshall2007",
  ),
  LH: known(
    l3("Corne latérale", "Lateral horn", "Cuerno lateral"),
    l3("Réponses olfactives innées.", "Innate olfactory responses.", "Respuestas olfativas innatas."),
    "vosshall2007",
  ),
  CA: known(
    l3("Calice du corps pédonculé", "Mushroom body calyx", "Cáliz del cuerpo pedunculado"),
    l3(
      "Entrée du corps pédonculé, centre de la mémoire associative.",
      "Input of the mushroom body, the centre of associative memory.",
      "Entrada del cuerpo pedunculado, centro de la memoria asociativa.",
    ),
    "aso2014",
  ),
  PED: known(l3("Pédoncule du corps pédonculé", "Mushroom body peduncle", "Pedúnculo del cuerpo pedunculado"), MB_ROLE, "aso2014"),
  aL: known(l3("Lobe α du corps pédonculé", "Mushroom body α lobe", "Lóbulo α del cuerpo pedunculado"), MB_ROLE, "aso2014"),
  "a'L": known(l3("Lobe α′ du corps pédonculé", "Mushroom body α′ lobe", "Lóbulo α′ del cuerpo pedunculado"), MB_ROLE, "aso2014"),
  bL: known(l3("Lobe β du corps pédonculé", "Mushroom body β lobe", "Lóbulo β del cuerpo pedunculado"), MB_ROLE, "aso2014"),
  "b'L": known(l3("Lobe β′ du corps pédonculé", "Mushroom body β′ lobe", "Lóbulo β′ del cuerpo pedunculado"), MB_ROLE, "aso2014"),
  gL: known(l3("Lobe γ du corps pédonculé", "Mushroom body γ lobe", "Lóbulo γ del cuerpo pedunculado"), MB_ROLE, "aso2014"),
  SAD: known(
    l3("Zone antennaire ventrale (SAD)", "Saddle (SAD)", "Silla antenal (SAD)"),
    l3(
      "Reçoit les neurones mécanosensoriels de l'antenne (audition, gravité).",
      "Receives the antenna's mechanosensory neurons (hearing, gravity).",
      "Recibe las neuronas mecanosensoriales de la antena (audición, gravedad).",
    ),
    "kamikouchi2009",
  ),
  WED: unknown("Coin (wedge)", "Wedge", "Cuña (wedge)"),
  SMP: unknown("Protocérébrum médian supérieur", "Superior medial protocerebrum", "Protocerebro medial superior"),
  SLP: unknown("Protocérébrum latéral supérieur", "Superior lateral protocerebrum", "Protocerebro lateral superior"),
  SIP: unknown("Protocérébrum intermédiaire supérieur", "Superior intermediate protocerebrum", "Protocerebro intermedio superior"),
  CRE: unknown("Crépine", "Crepine", "Crepina"),
  ICL: unknown("Clamp inférieur", "Inferior clamp", "Abrazadera inferior"),
  SCL: unknown("Clamp supérieur", "Superior clamp", "Abrazadera superior"),
  IB: unknown("Pont inférieur", "Inferior bridge", "Puente inferior"),
  ATL: unknown("Antler", "Antler", "Asta (antler)"),
  EPA: unknown("Épaulette", "Epaulette", "Charretera"),
  GOR: unknown("Gorget", "Gorget", "Gorguera"),
  CAN: unknown("Cantle", "Cantle", "Arzón (cantle)"),
  FLA: unknown("Lobe flange", "Flange", "Lóbulo reborde (flange)"),
  PRW: unknown("Zone pré-orale (PRW)", "Prow (PRW)", "Zona preoral (PRW)"),
  // Ventral nerve cord (targets of descending neurons, Namiki et al. 2018)
  "LegNp(T1)": known(
    l3("Neuropile des pattes avant (T1)", "Front leg neuropil (T1)", "Neuropilo de las patas delanteras (T1)"),
    l3(
      "Circuits moteurs des pattes avant ; cible de nombreux neurones descendants.",
      "Motor circuits of the front legs; target of many descending neurons.",
      "Circuitos motores de las patas delanteras; diana de muchas neuronas descendentes.",
    ),
    "namiki2018",
  ),
  "LegNp(T2)": known(
    l3("Neuropile des pattes médianes (T2)", "Middle leg neuropil (T2)", "Neuropilo de las patas medias (T2)"),
    l3(
      "Circuits moteurs des pattes médianes ; cible de nombreux neurones descendants.",
      "Motor circuits of the middle legs; target of many descending neurons.",
      "Circuitos motores de las patas medias; diana de muchas neuronas descendentes.",
    ),
    "namiki2018",
  ),
  "LegNp(T3)": known(
    l3("Neuropile des pattes arrière (T3)", "Hind leg neuropil (T3)", "Neuropilo de las patas traseras (T3)"),
    l3(
      "Circuits moteurs des pattes arrière ; cible de nombreux neurones descendants.",
      "Motor circuits of the hind legs; target of many descending neurons.",
      "Circuitos motores de las patas traseras; diana de muchas neuronas descendentes.",
    ),
    "namiki2018",
  ),
  "WTct(UTct-T2)": known(
    l3("Tectulum des ailes", "Wing tectulum", "Tectulum de las alas"),
    l3("Circuits moteurs du vol (ailes).", "Flight motor circuits (wings).", "Circuitos motores del vuelo (alas)."),
    "namiki2018",
  ),
  "HTct(UTct-T3)": known(
    l3("Tectulum des haltères", "Haltere tectulum", "Tectulum de los halterios"),
    l3(
      "Circuits des haltères (équilibre en vol).",
      "Haltere circuits (balance in flight).",
      "Circuitos de los halterios (equilibrio en vuelo).",
    ),
    "namiki2018",
  ),
  "NTct(UTct-T1)": known(
    l3("Tectulum du cou", "Neck tectulum", "Tectulum del cuello"),
    l3(
      "Circuits moteurs du cou (mouvements de la tête).",
      "Neck motor circuits (head movements).",
      "Circuitos motores del cuello (movimientos de la cabeza).",
    ),
    "namiki2018",
  ),
  IntTct: unknown("Tectulum intermédiaire", "Intermediate tectulum", "Tectulum intermedio"),
  LTct: unknown("Tectulum inférieur", "Lower tectulum", "Tectulum inferior"),
  Ov: unknown("Neuropile ovoïde", "Ovoid neuropil", "Neuropilo ovoide"),
  ANm: unknown("Neuromères abdominaux", "Abdominal neuromeres", "Neurómeros abdominales"),
  "CentralBrain-unspecified": unknown(
    "Cerveau central (zone non attribuée)",
    "Central brain (unassigned)",
    "Cerebro central (zona no asignada)",
  ),
  "Optic-unspecified": unknown("Lobe optique (zone non attribuée)", "Optic lobe (unassigned)", "Lóbulo óptico (zona no asignada)"),
  "VNC-unspecified": unknown(
    "Corde nerveuse (zone non attribuée)",
    "Ventral nerve cord (unassigned)",
    "Cordón nervioso (zona no asignada)",
  ),
  "brain-shell": unknown("Contour du cerveau", "Brain outline", "Contorno del cerebro"),
  "vnc-neuropil-shell": unknown("Contour de la corde nerveuse", "Nerve cord outline", "Contorno del cordón nervioso"),
};

const SIDES: Record<"L" | "R", L3> = {
  L: l3("gauche", "left", "izquierdo"),
  R: l3("droite", "right", "derecho"),
};

/** Region info for a neuPrint ROI name such as "ME(R)" or "EB", in the given language. */
export function regionInfo(roi: string, lang: FlyLang = "fr"): RegionInfo & { side: string | null; code: string } {
  const m = /^(.*?)(?:\((L|R)\))?$/.exec(roi);
  const code = m?.[1] ?? roi;
  const side = m?.[2] === "L" || m?.[2] === "R" ? SIDES[m[2]][lang] : null;
  const r = REGIONS[code];
  if (!r) return { name: code, role: null, source: null, side, code };
  return { name: r.name[lang], role: r.role?.[lang] ?? null, source: r.source, side, code };
}
