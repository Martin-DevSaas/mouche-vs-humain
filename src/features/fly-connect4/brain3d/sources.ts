// References for every role shown in the brain map (also listed in "Crédits & sources").

export const SOURCES = {
  ito2014: "Ito K. et al. A systematic nomenclature for the insect brain. Neuron 81, 755–765 (2014).",
  nern2025: "Nern A. et al. Connectome-driven neural inventory of a complete visual system. Nature 641 (2025).",
  borst2010: "Borst A., Haag J., Reiff D.F. Fly motion vision. Annu. Rev. Neurosci. 33, 49–70 (2010).",
  wu2016: "Wu M. et al. Visual projection neurons in the Drosophila lobula link feature detection to distinct behavioral programs. eLife 5, e21022 (2016).",
  omoto2017: "Omoto J.J. et al. Visual input to the Drosophila central complex by developmentally and functionally distinct neuronal populations. Curr. Biol. 27, 1098–1110 (2017).",
  seelig2015: "Seelig J.D., Jayaraman V. Neural dynamics for landmark orientation and angular path integration. Nature 521, 186–191 (2015).",
  hulse2021: "Hulse B.K. et al. A connectome of the Drosophila central complex reveals network motifs suitable for flexible navigation and context-dependent action selection. eLife 10, e66039 (2021).",
  namiki2018: "Namiki S. et al. The functional organization of descending sensory-motor pathways in Drosophila. eLife 7, e34272 (2018).",
  aso2014: "Aso Y. et al. The neuronal architecture of the mushroom body provides a logic for associative learning. eLife 3, e04577 (2014).",
  vosshall2007: "Vosshall L.B., Stocker R.F. Molecular architecture of smell and taste in Drosophila. Annu. Rev. Neurosci. 30, 505–533 (2007).",
  kamikouchi2009: "Kamikouchi A. et al. The neural basis of Drosophila gravity-sensing and hearing. Nature 458, 165–171 (2009).",
  shiu2024: "Shiu P.K. et al. A Drosophila computational brain model reveals sensorimotor processing. Nature 634, 210–219 (2024).",
  clark2011: "Clark D.A. et al. Defining the computational structure of the motion detector in Drosophila. Neuron 70, 1165–1177 (2011).",
  behnia2014: "Behnia R. et al. Processing properties of ON and OFF pathways for Drosophila motion detection. Nature 512, 427–430 (2014).",
  maisak2013: "Maisak M.S. et al. A directional tuning map of Drosophila elementary motion detectors. Nature 500, 212–216 (2013).",
  klapoetke2017: "Klapoetke N.C. et al. Ultra-selective looming detection from radial motion opponency. Nature 551, 237–241 (2017).",
  rayshubskiy2025: "Rayshubskiy A. et al. Neural circuit mechanisms for steering control in walking Drosophila. eLife (2025).",
} as const;

export type SourceKey = keyof typeof SOURCES;
