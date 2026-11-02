// French names (Ito et al. 2014 nomenclature) and sourced roles of the neuropils.
// Rule: a role is shown only with a reference; otherwise "rôle inconnu".

import type { SourceKey } from "./sources";

export interface RegionInfo {
  name: string;
  role: string | null;
  source: SourceKey | null;
}

const UNKNOWN = (name: string): RegionInfo => ({ name, role: null, source: null });

const REGIONS: Record<string, RegionInfo> = {
  LA: { name: "Lamina", role: "Premier relais visuel : reçoit les photorécepteurs R1–R6 de chaque ommatidie.", source: "nern2025" },
  ME: { name: "Médulla", role: "Traitement visuel colonne par colonne (contraste, couleur, premières étapes du calcul du mouvement).", source: "nern2025" },
  AME: UNKNOWN("Médulla accessoire"),
  LO: { name: "Lobula", role: "Détection de traits visuels ; ses neurones LC projettent vers les glomérules optiques.", source: "wu2016" },
  LOP: { name: "Plaque lobulaire", role: "Mouvement visuel à grand champ, par direction (neurones T4/T5, HS/VS).", source: "borst2010" },
  AOTU: { name: "Tubercule optique antérieur", role: "Relais d'information visuelle vers le complexe central.", source: "omoto2017" },
  BU: { name: "Bulbe", role: "Relais visuel entre le tubercule optique et le corps ellipsoïde.", source: "omoto2017" },
  PVLP: { name: "Protocérébrum ventrolatéral postérieur", role: "Contient des glomérules optiques recevant les neurones LC (objets, approche).", source: "wu2016" },
  PLP: { name: "Protocérébrum latéral postérieur", role: "Contient des glomérules optiques recevant les neurones LC.", source: "wu2016" },
  AVLP: UNKNOWN("Protocérébrum ventrolatéral antérieur"),
  EB: { name: "Corps ellipsoïde", role: "Boussole interne : l'activité y code le cap de la mouche.", source: "seelig2015" },
  PB: { name: "Pont protocérébral", role: "Représentation du cap, en lien avec le corps ellipsoïde.", source: "hulse2021" },
  FB: { name: "Corps en éventail", role: "Navigation : intègre le cap et des signaux internes pour orienter le comportement.", source: "hulse2021" },
  NO: { name: "Noduli", role: "Reçoivent des signaux de mouvement propre utilisés pour la navigation.", source: "hulse2021" },
  AB: UNKNOWN("Corps asymétrique"),
  LAL: { name: "Lobe accessoire latéral", role: "Relie le complexe central aux neurones descendants ; contrôle des virages.", source: "namiki2018" },
  SPS: { name: "Pente postérieure supérieure", role: "Région riche en neurones descendants (mouvements du corps et de la tête).", source: "namiki2018" },
  IPS: { name: "Pente postérieure inférieure", role: "Région riche en neurones descendants (mouvements du corps et de la tête).", source: "namiki2018" },
  VES: { name: "Veste", role: "Région riche en neurones descendants.", source: "namiki2018" },
  GNG: { name: "Ganglions gnathaux", role: "Goût et commande de la trompe ; nombreux neurones descendants.", source: "shiu2024" },
  AL: { name: "Lobe antennaire", role: "Premier relais de l'odorat.", source: "vosshall2007" },
  LH: { name: "Corne latérale", role: "Réponses olfactives innées.", source: "vosshall2007" },
  CA: { name: "Calice du corps pédonculé", role: "Entrée du corps pédonculé, centre de la mémoire associative.", source: "aso2014" },
  PED: { name: "Pédoncule du corps pédonculé", role: "Corps pédonculé : mémoire associative.", source: "aso2014" },
  aL: { name: "Lobe α du corps pédonculé", role: "Corps pédonculé : mémoire associative.", source: "aso2014" },
  "a'L": { name: "Lobe α′ du corps pédonculé", role: "Corps pédonculé : mémoire associative.", source: "aso2014" },
  bL: { name: "Lobe β du corps pédonculé", role: "Corps pédonculé : mémoire associative.", source: "aso2014" },
  "b'L": { name: "Lobe β′ du corps pédonculé", role: "Corps pédonculé : mémoire associative.", source: "aso2014" },
  gL: { name: "Lobe γ du corps pédonculé", role: "Corps pédonculé : mémoire associative.", source: "aso2014" },
  SAD: { name: "Zone antennaire ventrale (SAD)", role: "Reçoit les neurones mécanosensoriels de l'antenne (audition, gravité).", source: "kamikouchi2009" },
  WED: UNKNOWN("Coin (wedge)"),
  SMP: UNKNOWN("Protocérébrum médian supérieur"),
  SLP: UNKNOWN("Protocérébrum latéral supérieur"),
  SIP: UNKNOWN("Protocérébrum intermédiaire supérieur"),
  CRE: UNKNOWN("Crépine"),
  ICL: UNKNOWN("Clamp inférieur"),
  SCL: UNKNOWN("Clamp supérieur"),
  IB: UNKNOWN("Pont inférieur"),
  ATL: UNKNOWN("Antler"),
  EPA: UNKNOWN("Épaulette"),
  GOR: UNKNOWN("Gorget"),
  CAN: UNKNOWN("Cantle"),
  FLA: UNKNOWN("Lobe flange"),
  PRW: UNKNOWN("Zone pré-orale (PRW)"),
  // Ventral nerve cord (targets of descending neurons, Namiki et al. 2018)
  "LegNp(T1)": { name: "Neuropile des pattes avant (T1)", role: "Circuits moteurs des pattes avant ; cible de nombreux neurones descendants.", source: "namiki2018" },
  "LegNp(T2)": { name: "Neuropile des pattes médianes (T2)", role: "Circuits moteurs des pattes médianes ; cible de nombreux neurones descendants.", source: "namiki2018" },
  "LegNp(T3)": { name: "Neuropile des pattes arrière (T3)", role: "Circuits moteurs des pattes arrière ; cible de nombreux neurones descendants.", source: "namiki2018" },
  "WTct(UTct-T2)": { name: "Tectulum des ailes", role: "Circuits moteurs du vol (ailes).", source: "namiki2018" },
  "HTct(UTct-T3)": { name: "Tectulum des haltères", role: "Circuits des haltères (équilibre en vol).", source: "namiki2018" },
  "NTct(UTct-T1)": { name: "Tectulum du cou", role: "Circuits moteurs du cou (mouvements de la tête).", source: "namiki2018" },
  IntTct: UNKNOWN("Tectulum intermédiaire"),
  LTct: UNKNOWN("Tectulum inférieur"),
  Ov: UNKNOWN("Neuropile ovoïde"),
  ANm: UNKNOWN("Neuromères abdominaux"),
  "CentralBrain-unspecified": UNKNOWN("Cerveau central (zone non attribuée)"),
  "Optic-unspecified": UNKNOWN("Lobe optique (zone non attribuée)"),
  "VNC-unspecified": UNKNOWN("Corde nerveuse (zone non attribuée)"),
  "brain-shell": UNKNOWN("Contour du cerveau"),
  "vnc-neuropil-shell": UNKNOWN("Contour de la corde nerveuse"),
};

/** Region info for a neuPrint ROI name such as "ME(R)" or "EB". */
export function regionInfo(roi: string): RegionInfo & { side: "gauche" | "droite" | null; code: string } {
  const m = /^(.*?)(?:\((L|R)\))?$/.exec(roi);
  const code = m?.[1] ?? roi;
  const side = m?.[2] === "L" ? "gauche" : m?.[2] === "R" ? "droite" : null;
  return { ...(REGIONS[code] ?? UNKNOWN(code)), side, code };
}
