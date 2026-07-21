export interface NatureAuthor {
  name: string;
  affKeys: string[];
  email?: string;
  corresponding?: boolean;
  equalContrib?: boolean;
}

export interface NatureAffiliation {
  key: string;
  text: string;
}

export interface NatureSection {
  id: string;
  title: string;
  content: string;
}

export interface NatureFigure {
  id: string;
  number: number;
  title: string;
  caption: string;
  placeholder: string;
}

export interface NatureTable {
  id: string;
  number: number;
  title: string;
  caption: string;
  headers: string[];
  rows: { cells: string[] }[];
}

export interface NaturePaperData {
  journal: string;
  volume: string;
  issue: string;
  year: string;
  pages: string;
  doi: string;
  articleType: string;
  received: string;
  accepted: string;
  published: string;

  title: string;
  authors: NatureAuthor[];
  affiliations: NatureAffiliation[];
  abstract: string;
  summary: string[];

  sections: NatureSection[];
  figures: NatureFigure[];
  tables: NatureTable[];
  references: string[];

  fontSize: number;
  lineSpacing: number;
  citationStyle: "Nature" | "APA" | "Vancouver";
}

export const NATURE_DEMO: NaturePaperData = {
  journal: "Nature",
  volume: "629",
  issue: "8010",
  year: "2024",
  pages: "118–126",
  doi: "10.1038/s41586-024-07243-8",
  articleType: "Article",
  received: "17 October 2023",
  accepted: "12 February 2024",
  published: "1 May 2024",

  title: "Widespread Symbiont Shuffling Mediates Coral Thermal Tolerance Across the Indo-Pacific",

  authors: [
    { name: "Maya L. Thornton", affKeys: ["1", "2"], email: "m.thornton@aims.gov.au", corresponding: true },
    { name: "Hiroshi Tanaka", affKeys: ["3"], equalContrib: true },
    { name: "Sofia Reyes-García", affKeys: ["4"], equalContrib: true },
    { name: "James O. Fitzpatrick", affKeys: ["1", "5"] },
    { name: "Nadia Abubakar", affKeys: ["6"] },
    { name: "Chen Wei", affKeys: ["7"] },
    { name: "Ricardo Vásquez", affKeys: ["4", "8"] },
  ],

  affiliations: [
    { key: "1", text: "Australian Institute of Marine Science, Townsville, QLD 4810, Australia" },
    { key: "2", text: "ARC Centre of Excellence for Coral Reef Studies, James Cook University, Townsville, QLD 4811, Australia" },
    { key: "3", text: "Tropical Biosphere Research Center, University of the Ryukyus, Okinawa 903-0213, Japan" },
    { key: "4", text: "Smithsonian Tropical Research Institute, Balboa, Ancón, Republic of Panama" },
    { key: "5", text: "School of Biological Sciences, University of Queensland, Brisbane, QLD 4072, Australia" },
    { key: "6", text: "Centre for Environment, Fisheries and Aquaculture Science (CEFAS), Lowestoft NR33 0HT, UK" },
    { key: "7", text: "South China Sea Institute of Oceanology, Chinese Academy of Sciences, Guangzhou 510301, China" },
    { key: "8", text: "Naos Marine Laboratories, Smithsonian Tropical Research Institute, City of Knowledge, Republic of Panama" },
  ],

  abstract: `Rising ocean temperatures are driving mass coral bleaching events of unprecedented frequency and severity, yet corals display marked variation in their thermal tolerance—a phenomenon whose mechanistic basis remains incompletely resolved. Here we show that symbiont community shuffling, the rapid restructuring of endosymbiotic dinoflagellate (Symbiodiniaceae) assemblages in response to thermal stress, is far more prevalent and geographically widespread than previously recognized. Using metabarcoding of 4,127 coral colonies spanning 23 reef systems across the Indo-Pacific, we find that 61% of thermally tolerant corals underwent significant symbiont shuffling within two bleaching seasons, compared with 14% in susceptible colonies. Shuffling events were dominated by transitions toward thermally resistant Durusdinium and Fugacium clades. Corals that successfully incorporated heat-tolerant symbionts exhibited 2.4-fold lower bleaching incidence and 31% higher long-term survival over the subsequent five years. Thermal tolerance acquired through shuffling was heritable across one sexual generation in two broadcast-spawning species, suggesting a transgenerational mechanism for rapid acclimatization. Our findings reveal symbiont shuffling as a widespread, ecologically consequential adaptive response that substantially modulates reef resilience under accelerating climate change.`,

  summary: [
    "61% of thermally tolerant corals underwent symbiont shuffling within two bleaching seasons, compared with only 14% in susceptible colonies",
    "Shuffling toward Durusdinium and Fugacium clades conferred 2.4-fold lower bleaching incidence and 31% higher five-year survival",
    "Thermal tolerance acquired through shuffling was heritable across one sexual generation in two broadcast-spawning coral species",
    "Symbiont shuffling represents a widespread and ecologically consequential adaptive mechanism modulating reef resilience under climate change",
  ],

  sections: [
    {
      id: "s1",
      title: "Introduction",
      content: `Tropical coral reefs support approximately 25% of all described marine species and provide ecosystem services valued at over US$375 billion annually to more than one billion people. Yet reef ecosystems are under existential threat from anthropogenic climate change: global sea surface temperatures have risen by ~0.13°C per decade since 1951, and projections under moderate emissions scenarios (SSP2-4.5) predict that virtually all reef-building corals will experience annual severe bleaching by 2050–2060.

The physiological basis of coral bleaching is well established: elevated temperature exceeding the thermal threshold of the coral holobiont by 1–2°C for several weeks causes the breakdown of the obligate endosymbiotic relationship between coral host cells and photosynthetic dinoflagellates of the family Symbiodiniaceae. The resulting loss of algal symbionts—bleaching—deprives the coral host of up to 90% of its carbon acquisition through photosynthate transfer, triggering starvation and, if bleaching is prolonged, mortality.

However, corals exhibit striking heterogeneity in their thermal tolerance both within and among species and reef systems. Colonies on warmer back-reef environments frequently survive bleaching events that cause mass mortality on adjacent fore-reef slopes. Intraspecific thermal tolerance gradients spanning 1.5–3°C have been documented across depth and latitude in several major reef-building taxa including Acropora millepora, Porites lobata, and Orbicella faveolata. The genetic and ecological determinants of this heterogeneity are among the most pressing unresolved questions in coral reef science, with direct implications for identifying and protecting thermally resilient reef populations.

Symbiont identity is a well-recognized modulator of coral thermal tolerance. The genus Symbiodinium sensu stricto (Clade A) forms the ancestral symbiosis in many corals but confers relatively low thermal tolerance. In contrast, Durusdinium (formerly Clade D) and several lineages within Fugacium (Clade F) exhibit substantially elevated photosystem II thermostability and protective carotenoid synthesis. Corals harboring Durusdinium trenchii as their dominant symbiont can withstand temperatures 1–2°C above typical bleaching thresholds. The dominant paradigm, however, has treated symbiont community composition as largely fixed in adult corals—a hypothesis termed the "shuffling hypothesis" versus "switching hypothesis" debate in which shuffling refers to changes in the proportional representation of symbionts already present, while switching refers to the acquisition of entirely novel symbiont strains from the environment.

Here we present the most comprehensive assessment to date of symbiont community dynamics under bleaching stress, integrating temporal metabarcoding, long-term survival monitoring, and reciprocal transplantation experiments across 23 Indo-Pacific reef systems.`,
    },
    {
      id: "s2",
      title: "Results",
      content: `Prevalence and geographic distribution of symbiont shuffling. We collected tissue samples from 4,127 coral colonies at three time points: pre-bleaching baseline (November–December 2019), acute bleaching peak (March–April 2020), and post-bleaching recovery (October–November 2021). Colonies were classified as thermally tolerant (no visible bleaching or full recovery within 3 months; n = 1,847) or thermally susceptible (bleached >50% surface area with delayed or incomplete recovery; n = 2,280) based on photographic monitoring.

Metabarcoding of the Symbiodiniaceae ITS2 locus revealed that symbiont shuffling—operationally defined as a ≥20% change in the proportional abundance of any Symbiodiniaceae genus within a colony—occurred in 61.3% of thermally tolerant colonies between baseline and acute bleaching timepoints, compared with only 13.9% in susceptible colonies (odds ratio 9.7, 95% CI 7.8–12.1; χ² = 1,243.6, P < 10⁻¹⁵⁰; Fig. 1a). Shuffling events were geographically widespread, detected in all 23 reef systems surveyed and across all 14 coral genera represented in our dataset.

The taxonomic composition of shuffling events was highly consistent across geography. In 87.4% of shuffling-tolerant colonies, the post-bleaching symbiont community was enriched in Durusdinium (median relative abundance increase: +38.2 percentage points) or Fugacium (+21.7 pp) compared to baseline. By contrast, in shuffling-susceptible colonies, Symbiodinium and Cladocopium (Clade C) remained dominant throughout (Fig. 1b).

Long-term survival consequences. We tracked colony fate over five years (2019–2024) through annual photographic census. Colonies that underwent successful symbiont shuffling exhibited significantly higher five-year survival: 74.2% versus 43.1% in non-shuffling thermally susceptible colonies (log-rank P < 0.0001; hazard ratio 0.38, 95% CI 0.31–0.47; Fig. 2). The survival advantage was consistent across coral genera, reef depths, and the two bleaching events captured within the study window (2020 and 2022).

Mechanistic basis of shuffling-derived tolerance. To investigate the physiological mechanisms by which shuffled symbiont communities confer tolerance, we conducted reciprocal transplant experiments in six reef systems. Acropora millepora and Porites lobata colonies with naturally Durusdinium-enriched post-bleaching communities exhibited Fv/Fm values 32% higher than conspecifics retaining Cladocopium-dominated communities during the 2022 bleaching event. Transcriptomic profiling of a subset of shuffled versus non-shuffled colonies revealed significant upregulation of reactive oxygen species scavenging pathways (superoxide dismutase, catalase, glutathione peroxidase) in Durusdinium-enriched holobionts, consistent with the established protective function of elevated antioxidant activity.

Transgenerational heritability of shuffling-derived tolerance. In A. millepora and O. faveolata—two broadcast-spawning species amenable to controlled spawning experiments—we reared F1 offspring from shuffled (Durusdinium-enriched) and non-shuffled (Cladocopium-dominated) parent colonies. F1 larvae and juveniles were inoculated with standardized symbiont suspensions. At six months post-settlement, F1 juveniles from shuffled parents exhibited 2.4× higher uptake of Durusdinium trenchii and 1.8× higher 30-day survival under acute thermal stress compared with offspring of non-shuffled parents (P = 0.003 and P < 0.0001, respectively; Table 1), despite identical symbiont inoculation protocols. These results suggest that epigenetic or maternal provisioning mechanisms transmit Durusdinium affinity across sexual reproduction.`,
    },
    {
      id: "s3",
      title: "Discussion",
      content: `Our results establish symbiont shuffling as a prevalent, geographically widespread, and ecologically significant mechanism of coral thermal tolerance, challenging the prevailing view that symbiont communities are largely fixed in adult corals. The high frequency of shuffling events (61% of tolerant colonies) across diverse reef systems and coral genera indicates that this capacity is a broadly distributed trait in the coral holobiont, not restricted to particular species or thermal environments.

The strong enrichment of Durusdinium and Fugacium in post-bleaching shuffled communities, combined with the substantial survival advantage conferred over five years, positions symbiont shuffling as a first-order determinant of individual reef resilience to bleaching events. The magnitude of the effect—2.4-fold lower bleaching incidence and 31% higher long-term survival—is comparable to or exceeds other proposed tolerance mechanisms including host genetic adaptation (Palumbi et al., 2014), epigenetic acclimatization (Putnam et al., 2016), and microbiome restructuring (Ziegler et al., 2019).

The transgenerational heritability of shuffling-derived tolerance represents perhaps the most consequential finding of our study. The demonstration that F1 offspring of shuffled parents preferentially acquire Durusdinium at recruitment and exhibit enhanced thermal performance under controlled conditions provides a mechanistic link between within-generational acclimatization and multi-generational adaptation. This finding is consistent with theoretical models predicting that maternal epigenetic programming of symbiont affinities could accelerate holobiont adaptation to warming far beyond what host genomic evolution alone would permit.

Importantly, our data do not imply that symbiont shuffling will be sufficient to protect reefs under high-emissions trajectories. Durusdinium-dominated symbioses typically carry a fitness cost under ambient temperatures—reduced photosynthate transfer and slower growth—that may compromise competitive ability in undisturbed reef communities. Furthermore, the capacity for shuffling appears to vary considerably among coral species and is absent in several major reef-builders including many faviids and dendrophylliids. Conservation strategies targeting the identification and protection of populations with high shuffling potential, and the assisted colonization of heat-tolerant symbiont strains, may substantially augment the limited adaptive capacity of the reef-building coral fauna.`,
    },
    {
      id: "s4",
      title: "Methods",
      content: `Survey design and sample collection. We selected 23 reef systems distributed across the Indo-Pacific spanning a latitudinal range from 23°N (Ryukyu Archipelago, Japan) to 23°S (Keppel Islands, Australia) and a longitudinal range from 99°E (Andaman Sea) to 139°W (French Polynesia). Within each reef system, we established 3–5 permanent transect lines at two depth strata (3–5 m and 8–12 m). All coral colonies intersecting or within 0.5 m of each transect were tagged with numbered titanium clips and photographed using a calibrated photoquadrat system at each sampling event.

Tissue biopsies (~1 cm²) were collected by SCUBA using bone cutters and immediately preserved in DMSO–EDTA–NaCl buffer at −20°C within 2 hours. DNA extraction used the MagAttract PowerSoil DNA Kit (Qiagen). ITS2 amplicon libraries were prepared using the primers SYM_VAR_5.8S2/SYM_VAR_REV (Hume et al., 2018) with dual-indexed Nextera adapters and sequenced on an Illumina NovaSeq 6000 (2 × 250 bp). Raw reads were processed using the SymPortal analytical framework for defining ITS2 type profiles and taxonomic classification.

Thermal history and bleaching assessment. Sea surface temperature data were obtained from NOAA Coral Reef Watch at 5 km resolution. Degree Heating Weeks (DHW) at each reef system were calculated as cumulative thermal anomalies exceeding the maximum monthly mean by ≥1°C over rolling 12-week windows. Colony bleaching status was assessed from standardized underwater photographs by three independent observers masked to colony identity and thermal history, using the CoralNet annotation platform with the CoralNet deep-learning classifier (Beijbom et al., 2016). Interobserver agreement exceeded κ = 0.91.

Statistical analyses. Logistic regression models for bleaching incidence included reef system and coral genus as random effects (R package lme4). Survival analyses used Cox proportional hazards models with robust variance estimation. All shuffling prevalence comparisons used chi-squared tests with Bonferroni correction for multiple testing across genera and reef systems. All statistical tests were two-tailed with α = 0.05 unless otherwise noted. Sample sizes, effect sizes, and exact P values are reported in the Supplementary Statistical Summary.`,
    },
  ],

  figures: [
    {
      id: "f1",
      number: 1,
      title: "Symbiont shuffling prevalence and community composition across bleaching tolerance categories.",
      caption: "a, Proportion of thermally tolerant versus susceptible coral colonies exhibiting symbiont shuffling (≥20% change in any Symbiodiniaceae genus) between pre-bleaching baseline and acute bleaching peak sampling timepoints. Error bars show 95% confidence intervals. n = 1,847 tolerant, n = 2,280 susceptible colonies. b, Ternary plot of Symbiodiniaceae community composition at three timepoints for shuffling-tolerant (blue), non-shuffling tolerant (green), and susceptible (red) colonies. Vertices represent Cladocopium, Durusdinium, and all other genera. c, Geographic map of all 23 reef systems with pie charts indicating the proportion of sampled colonies in each shuffling category.",
      placeholder: "#dbeafe",
    },
    {
      id: "f2",
      number: 2,
      title: "Five-year survival of coral colonies stratified by symbiont shuffling outcome.",
      caption: "Kaplan–Meier survival curves for colonies that underwent successful symbiont shuffling toward thermally resistant genera (blue, n = 892), colonies that experienced shuffling without enrichment of resistant genera (orange, n = 248), and non-shuffling thermally susceptible colonies (red, n = 2,280). Shaded regions indicate 95% confidence intervals. Tick marks denote censored observations. Log-rank P < 0.0001 for all pairwise comparisons.",
      placeholder: "#dcfce7",
    },
    {
      id: "f3",
      number: 3,
      title: "Transgenerational heritability of shuffling-derived thermal tolerance in Acropora millepora.",
      caption: "a, Experimental design for F1 offspring thermal challenge assay. Gametes from shuffled (Dur-enriched) and non-shuffled (Clad-dominated) parents were separately fertilized and reared under identical conditions before inoculation with standardized Symbiodiniaceae suspensions at larval settlement. b, Proportion of settled juveniles harboring Durusdinium trenchii as dominant symbiont at 6 months post-settlement. c, 30-day survival of F1 juveniles under acute thermal stress (32°C, 7 days). Box plots show median, interquartile range, and 1.5× IQR whiskers; individual datapoints overlaid. ***P < 0.001, ****P < 0.0001 (Mann–Whitney U test).",
      placeholder: "#fce7f3",
    },
  ],

  tables: [
    {
      id: "t1",
      number: 1,
      title: "Transgenerational heritability of symbiont composition and thermal performance",
      caption: "Symbiont uptake and thermal performance metrics for F1 offspring of shuffled (Durusdinium-enriched) versus non-shuffled (Cladocopium-dominated) parent colonies in Acropora millepora and Orbicella faveolata. Values are means ± s.d. P values from two-tailed Mann–Whitney U tests.",
      headers: ["Metric", "Shuffled parents", "Non-shuffled parents", "P value"],
      rows: [
        { cells: ["Durusdinium uptake rate (%)", "64.3 ± 8.7", "26.8 ± 6.1", "0.003"] },
        { cells: ["30-day survival at 32°C (%)", "71.2 ± 5.4", "39.6 ± 7.2", "< 0.0001"] },
        { cells: ["Fv/Fm at bleaching threshold", "0.58 ± 0.04", "0.41 ± 0.06", "< 0.0001"] },
        { cells: ["Growth rate (mm/month)", "1.14 ± 0.22", "1.09 ± 0.19", "0.41"] },
      ],
    },
  ],

  references: [
    "1. Hughes, T. P. et al. Global warming and recurrent mass bleaching of corals. Nature 543, 373–377 (2017).",
    "2. Hughes, T. P. et al. Spatial and temporal patterns of mass bleaching of corals in the Anthropocene. Science 359, 80–83 (2018).",
    "3. Hoegh-Guldberg, O. et al. Coral reefs under rapid climate change and ocean acidification. Science 318, 1737–1742 (2007).",
    "4. Berkelmans, R. & van Oppen, M. J. H. The role of zooxanthellae in the thermal tolerance of corals: a 'nugget of hope' for coral reefs in an era of climate change. Proc. R. Soc. B 273, 2305–2312 (2006).",
    "5. Palumbi, S. R. et al. Mechanisms of reef coral resistance to future climate change. Science 344, 895–898 (2014).",
    "6. van Oppen, M. J. H., Gates, R. D., Blackall, L. L., Cantin, N. & Chakravarti, L. J. Shifting paradigms in restoration of the world's coral reefs. Glob. Change Biol. 23, 3437–3448 (2017).",
    "7. Silverstein, R. N., Cunning, R. & Baker, A. C. Change in algal symbiont communities after bleaching, not prior heat exposure, increases heat tolerance of reef corals. Glob. Change Biol. 21, 236–249 (2015).",
    "8. Putnam, H. M., Davidson, J. M. & Gates, R. D. Ocean acidification influences host DNA methylation and phenotypic plasticity in environmentally susceptible corals. Evol. Appl. 9, 1165–1178 (2016).",
    "9. Ziegler, M. et al. Coral bacterial community structure responds to environmental change in a host-specific manner. Nat. Commun. 10, 3092 (2019).",
    "10. Hume, B. C. C. et al. An improved primer set and amplification protocol with increased specificity and sensitivity targeting the Symbiodinium ITS2 region. PeerJ 6, e4816 (2018).",
    "11. Stat, M., Morris, E. & Gates, R. D. Functional diversity in coral–dinoflagellate symbiosis. Proc. Natl Acad. Sci. USA 105, 9256–9261 (2008).",
    "12. Cunning, R. & Baker, A. C. Excess algal symbionts increase the susceptibility of reef corals to bleaching. Nat. Clim. Change 3, 259–262 (2013).",
    "13. Jones, A. M. et al. Coral bleaching: Zooxanthellae cell density and photosynthetic efficiency in reef corals. Mar. Ecol. Prog. Ser. 449, 97–109 (2012).",
    "14. Bates, D., Maechler, M., Bolker, B. & Walker, S. Fitting linear mixed-effects models using lme4. J. Stat. Softw. 67, 1–48 (2015).",
  ],

  fontSize: 10,
  lineSpacing: 1.5,
  citationStyle: "Nature",
};
