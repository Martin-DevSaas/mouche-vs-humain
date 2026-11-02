// Every reference shown in "Crédits & sources" (roles of the brain map are in brain3d/sources.ts).

import { SOURCES } from "../brain3d/sources";

export const DATA_CREDITS = [
  {
    what: "Connectome MaleCNS v1.0 (neurones, synapses, neurotransmetteurs prédits, neuropiles, colonnes optiques)",
    who: "Janelia FlyEM, MRC LMB Cambridge, Google Research et al.",
    ref: "Berg S. et al. Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. Cell 189, 5504–5526 (2026). doi:10.1016/j.cell.2026.08.015",
    license: "CC-BY 4.0",
    url: "https://male-cns.janelia.org",
  },
  {
    what: "Enregistrements de DNa01/DNa02 utilisés pour mesurer le gain de virage",
    who: "Rayshubskiy, Holtz, Bates, Vanderbeck, Serratosa Capdevila, Rockwell & Wilson",
    ref: "Harvard Dataverse, doi:10.7910/DVN/0NCLP1",
    license: "CC0",
    url: "https://doi.org/10.7910/DVN/0NCLP1",
  },
  {
    what: "Modèle de neurone (paramètres et équations), reproduit en TypeScript",
    who: "Shiu, Sterne, Spiller, Franconville et al.",
    ref: "github.com/philshiu/Drosophila_brain_model (commit 91bdd1e)",
    license: "MIT",
    url: "https://github.com/philshiu/Drosophila_brain_model",
  },
];

export const REFERENCES: string[] = [
  "Shiu P.K. et al. A Drosophila computational brain model reveals sensorimotor processing. Nature 634, 210–219 (2024).",
  "Rayshubskiy A. et al. Neural circuit mechanisms for steering control in walking Drosophila. eLife (2025). doi:10.7554/eLife.102230",
  "Nern A. et al. Connectome-driven neural inventory of a complete visual system. Nature 641 (2025). doi:10.1038/s41586-025-08746-0",
  "Zhao A. et al. Eye structure shapes neuron function in Drosophila motion vision. Nature 646, 135–142 (2025). doi:10.1038/s41586-025-09276-5",
  "Sharkey C.R. et al. The spectral sensitivity of Drosophila photoreceptors. Sci. Rep. 10, 18242 (2020).",
  "Juusola M. et al. Microsaccadic sampling of moving image information provides Drosophila hyperacute vision. eLife 6, e26117 (2017).",
  "Govardovskii V.I. et al. In search of the visual pigment template. Vis. Neurosci. 17, 509–528 (2000).",
  "Mallett I., Yuksel C. Spectral primary decomposition for rendering with sRGB reflectance. EGSR (2019).",
  "Wang-Chen S. et al. NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila. Nat. Methods 21 (2024). doi:10.1038/s41592-024-02497-y",
  "Maimon G., Straw A.D., Dickinson M.H. A simple vision-based algorithm for decision making in flying Drosophila. Curr. Biol. 18, 464–470 (2008).",
  "Reichardt W., Wenking H. Optical detection and fixation of objects by fixed flying flies. Naturwissenschaften 56, 424–425 (1969).",
  "Laughlin S. A simple coding procedure enhances a neuron's information capacity. Z. Naturforsch. 36c, 910–912 (1981).",
  ...Object.values(SOURCES).filter((s) => !s.startsWith("Shiu") && !s.startsWith("Nern") && !s.startsWith("Rayshubskiy")),
];
