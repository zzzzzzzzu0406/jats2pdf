import elsevierArchitecture from "../assets/journal-figures/elsevier-architecture.png";
import elsevierLqs from "../assets/journal-figures/elsevier-lqs.png";
import ieeeAccuracy from "../assets/journal-figures/ieee-accuracy.png";
import ieeeArchitecture from "../assets/journal-figures/ieee-architecture.png";
import ieeeHeterogeneity from "../assets/journal-figures/ieee-heterogeneity.png";
import springerAuc from "../assets/journal-figures/springer-auc.png";
import springerHierarchy from "../assets/journal-figures/springer-hierarchy.png";
import springerEmbedding from "../assets/journal-figures/springer-embedding.png";
import natureShuffling from "../assets/journal-figures/nature-shuffling.png";
import natureSurvival from "../assets/journal-figures/nature-survival.png";
import natureHeritability from "../assets/journal-figures/nature-heritability.png";

export const DEMO_FIGURE_ASSETS = {
  elsevier: [elsevierArchitecture, elsevierLqs],
  ieee: [ieeeAccuracy, ieeeArchitecture, ieeeHeterogeneity],
  springer: [springerAuc, springerHierarchy, springerEmbedding],
  nature: [natureShuffling, natureSurvival, natureHeritability],
} as const;
