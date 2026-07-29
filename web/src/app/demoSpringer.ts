import { DEMO_FIGURE_ASSETS } from "./demoFigureAssets";

export interface SpringerAuthor {
  name: string;
  affKeys: string[];
  email?: string;
  corresponding?: boolean;
}

export interface SpringerAffiliation {
  key: string;
  text: string;
}

export interface SpringerSection {
  id: string;
  number: string;
  title: string;
  content: string;
}

export interface SpringerFigure {
  id: string;
  number: number;
  caption: string;
  placeholder: string;
  src?: string;
}

export interface SpringerTable {
  id: string;
  number: number;
  caption: string;
  headers: string[];
  rows: { cells: string[] }[];
}

export interface SpringerPaperData {
  journal: string;
  journalAbbrev: string;
  publisher: string;
  issn: string;
  volume: string;
  issue: string;
  year: string;
  pages: string;
  doi: string;
  articleType: string;
  received: string;
  revised?: string;
  accepted: string;
  published: string;

  title: string;
  authors: SpringerAuthor[];
  affiliations: SpringerAffiliation[];
  abstract: string;
  keywords: string[];

  sections: SpringerSection[];
  figures: SpringerFigure[];
  tables: SpringerTable[];
  references: string[];

  fontSize: number;
  lineSpacing: number;
  citationStyle: "Springer" | "APA" | "Vancouver";
}

export const SPRINGER_DEMO: SpringerPaperData = {
  journal: "Machine Learning",
  journalAbbrev: "Mach Learn",
  publisher: "Springer",
  issn: "0885-6125",
  volume: "113",
  issue: "4",
  year: "2024",
  pages: "2187–2219",
  doi: "10.1007/s10994-024-06543-8",
  articleType: "Original Article",
  received: "14 February 2024",
  revised: "8 May 2024",
  accepted: "22 June 2024",
  published: "11 July 2024",

  title: "Hierarchical Contrastive Graph Learning for Few-Shot Molecular Property Prediction",

  authors: [
    { name: "Elena Vassiliev", affKeys: ["1"], email: "e.vassiliev@epfl.ch", corresponding: true },
    { name: "Tobias Riedel", affKeys: ["1", "2"] },
    { name: "Aisha Nakamura", affKeys: ["3"] },
    { name: "David Okonkwo", affKeys: ["2", "4"] },
  ],

  affiliations: [
    { key: "1", text: "Laboratory for Computational Biology and Bioinformatics, École Polytechnique Fédérale de Lausanne (EPFL), CH-1015 Lausanne, Switzerland" },
    { key: "2", text: "Department of Chemistry and Applied Biosciences, ETH Zürich, CH-8093 Zürich, Switzerland" },
    { key: "3", text: "Computational Drug Discovery Group, Wellcome Sanger Institute, Hinxton CB10 1SA, UK" },
    { key: "4", text: "Max Planck Institute for Informatics, 66123 Saarbrücken, Germany" },
  ],

  abstract: `Predicting molecular properties from structural representations remains a central challenge in computational chemistry and drug discovery. Graph neural networks (GNNs) have emerged as the dominant paradigm for molecular property prediction; however, they typically require large labeled datasets that are expensive and time-consuming to obtain through experimental assay. In this work, we propose HiCoGNN, a hierarchical contrastive graph learning framework that enables accurate few-shot molecular property prediction by exploiting multi-scale structural motifs. HiCoGNN constructs a three-level molecular hierarchy—atoms, functional groups, and scaffold fragments—and applies level-specific contrastive objectives that enforce consistency across augmented molecular views. During meta-learning, the model acquires transferable representations that generalize rapidly to novel property tasks from as few as five labeled examples. We evaluate HiCoGNN on eleven benchmark datasets from MoleculeNet and the TDC Benchmark Group. Under 5-shot settings, HiCoGNN achieves a mean AUC-ROC of 0.847 across classification benchmarks, outperforming the strongest GNN baseline by 4.3 percentage points and the best pre-training approach by 2.8 points. Ablation studies confirm the complementary contributions of hierarchical representation and multi-level contrastive loss. Our code and pre-trained models are publicly available.`,

  keywords: [
    "Graph neural networks",
    "Few-shot learning",
    "Molecular property prediction",
    "Contrastive learning",
    "Drug discovery",
    "Meta-learning",
  ],

  sections: [
    {
      id: "s1",
      number: "1",
      title: "Introduction",
      content: `The ability to predict molecular properties—including toxicity, solubility, binding affinity, and bioactivity—accurately and efficiently has profound implications for pharmaceutical development, materials design, and environmental risk assessment. Traditional computational approaches relying on hand-crafted molecular descriptors, such as Morgan fingerprints or physicochemical features, have been progressively superseded by deep learning methods that learn representations directly from molecular structure.

Graph neural networks have emerged as the natural architecture for molecular representation learning, treating atoms as graph nodes and bonds as edges. Models such as MPNN (Gilmer et al., 2017), AttentiveFP (Xiong et al., 2020), and GROVER (Rong et al., 2020) have demonstrated competitive performance on standard benchmarks. However, these models typically require thousands to tens of thousands of labeled training examples per task, a requirement that is frequently unmet in practice. Experimental property measurements are expensive, slow, and subject to assay variability.

Few-shot molecular property prediction addresses this bottleneck by training models that generalize from small labeled sets. Early work adapted MAML (Finn et al., 2017) and Prototypical Networks to the molecular domain. More recent approaches exploit molecular pre-training on large unlabeled corpora (Hu et al., 2020; Zhu et al., 2023), but the gap between pre-training objectives and downstream tasks limits their effectiveness in ultra-low-data regimes.

This work introduces HiCoGNN, which addresses two complementary limitations of prior methods. First, existing GNNs operate at a single level of molecular abstraction—typically atoms and bonds—neglecting the hierarchical organization of molecular structure into functional groups, rings, and scaffold fragments that domain chemists routinely exploit. Second, self-supervised contrastive objectives applied to molecules have predominantly used random subgraph augmentation, which may break chemically meaningful units.

HiCoGNN constructs a three-level molecular hierarchy and applies level-specific contrastive objectives that preserve chemical semantics. A graph-theoretic procedure identifies functional groups and scaffold fragments automatically from SMILES representations without domain supervision. The resulting multi-scale representations are then used within a gradient-based meta-learning outer loop, enabling rapid adaptation to new property tasks from a small labeled support set.

Our main contributions are: (1) a hierarchical molecular graph construction algorithm based on subgraph partitioning; (2) multi-level contrastive learning objectives with chemically-aware augmentation strategies; (3) a meta-learning framework that integrates hierarchical representations for few-shot adaptation; and (4) extensive benchmarking demonstrating state-of-the-art performance under 5- and 10-shot protocols across eleven datasets.`,
    },
    {
      id: "s2",
      number: "2",
      title: "Related Work",
      content: `Graph neural networks for molecules. Message-passing neural networks (MPNNs) process molecular graphs by iteratively aggregating neighbor information around each atom node. DMPNN (Yang et al., 2019) propagates messages along directed edges, improving information flow. Attentive mechanisms (AttentiveFP, SchNet, DimeNet++) incorporate distance and angular information for higher expressivity. These methods achieve strong performance on single-task benchmarks but require extensive data.

Pre-training strategies. Self-supervised pre-training on large molecular databases has attracted significant interest. Hu et al. (2020) proposed masked atom prediction and context-prediction pre-training tasks for GNNs. GROVER (Rong et al., 2020) employs transformer-based message passing with self-supervised tasks derived from molecular graph topology. MolBERT adapts BERT-style masking to SMILES sequences. Despite their generalization benefits, these models treat molecules as flat graphs, ignoring hierarchical structure, and their few-shot performance lags behind specialized meta-learning approaches.

Few-shot learning. The seminal MAML framework (Finn et al., 2017) enables fast adaptation through gradient-based meta-learning. Prototypical Networks (Snell et al., 2017) learn class-conditional embeddings for nearest-neighbor classification. MAML has been applied to molecular property prediction by Altae-Tran et al. (2017) and extended by PAR (Wang et al., 2021) to incorporate property-aware task representations. Meta-MGNN (Guo et al., 2021) integrates molecular pre-training with MAML but uses single-scale GNN representations.

Contrastive learning. MoCo, SimCLR, and BYOL established contrastive frameworks for visual representation learning. GraphCL (You et al., 2020) adapts contrastive objectives to graphs via subgraph, edge, and attribute augmentation. MolCLR (Wang et al., 2022) applies similar augmentations to molecular graphs. Our work differs by defining level-specific augmentations that respect chemical structure at each hierarchy level.`,
    },
    {
      id: "s3",
      number: "3",
      title: "Methodology",
      content: `3.1 Hierarchical Molecular Graph Construction

Given a molecule represented as a SMILES string, we construct a three-level hierarchy. Level 0 (atom level) corresponds to the standard molecular graph G₀ = (V_atom, E_bond). Level 1 (functional group level) partitions atoms into chemically coherent groups using the SMARTS-based functional group enumeration of Ertl (2017), supplemented by ring detection via SSSR. Each functional group becomes a supernode in G₁, with edges between supernodes sharing bridging atoms. Level 2 (scaffold level) identifies the Bemis–Murcko scaffold of the molecule and fragments peripheral chains, yielding a coarse graph G₂ capturing the molecular backbone.

3.2 Level-Specific Graph Neural Encoding

Each level is encoded by a separate GNN module with level-appropriate edge features. For G₀, edge features include bond type, conjugation, ring membership, and stereochemistry. For G₁, edge features encode the type of atoms forming the inter-group bridge. For G₂, scaffold fragments are encoded by mean-pooling their constituent atom representations from G₀. Inter-level messages are passed upward after each GNN layer, allowing high-level context to guide low-level representations.

3.3 Multi-Level Contrastive Objectives

For each level l ∈ {0, 1, 2}, we define a level-specific augmentation strategy. At the atom level, we apply random masking of atom attributes and random bond dropout, following GraphCL. At the functional group level, we selectively mask entire functional groups rather than individual atoms, preserving intra-group structure. At the scaffold level, we permute peripheral fragment attachments while retaining the scaffold, generating semantically similar but structurally varied views.

The contrastive loss at level l is the NT-Xent loss between paired augmented views of each molecule in the batch:

L_l = -1/|B| Σ log [exp(sim(z_i^l, z_j^l)/τ) / Σ_{k≠i} exp(sim(z_i^l, z_k^l)/τ)]

The total contrastive objective is L_con = Σ_l λ_l L_l, with level weights λ_l determined by a learned softmax gating mechanism.

3.4 Meta-Learning for Few-Shot Adaptation

We employ MAML as the outer loop optimizer. Each meta-training episode samples a task T from a held-out training task distribution—consisting of binary classification of molecular bioactivity endpoints—and constructs a support set S and query set Q. The inner loop performs K gradient steps on S using the concatenated multi-level molecular embeddings. The outer loop minimizes query set loss across episodes, updating shared GNN parameters and level gate weights.`,
    },
    {
      id: "s4",
      number: "4",
      title: "Experiments",
      content: `4.1 Datasets and Baselines

We evaluate on eleven datasets: Tox21, ToxCast, SIDER, ClinTox, BBBP, BACE, MUV, HIV, FreeSolv, ESOL, and Lipophilicity from MoleculeNet (Wu et al., 2018), supplemented by three TDC benchmark endpoints (hERG, CYP3A4, and PAMPA). Datasets are standardized via scaffold splits to prevent data leakage.

Baselines include: (a) classical ML with Morgan fingerprints + RF/SVM; (b) single-task GNN models (MPNN, DMPNN, AttentiveFP); (c) pre-trained GNN models (Hu et al., 2020; GROVER); (d) few-shot-specific methods (MAML, Prototypical Networks, PAR, Meta-MGNN). All models use the same 5-shot and 10-shot evaluation protocols.

4.2 Main Results

Table 1 reports mean AUC-ROC under 5-shot evaluation across classification benchmarks. HiCoGNN achieves a mean of 0.847, surpassing the second-best method (Meta-MGNN: 0.804) by 4.3 points. The improvement is most pronounced on structurally diverse benchmarks (MUV: +7.1%, SIDER: +5.6%), suggesting that hierarchical representations are particularly valuable when scaffold diversity is high.

Under 10-shot evaluation (Fig. 1), the gap narrows slightly to 3.1 points, as data-hungry baselines benefit more from additional examples. However, HiCoGNN maintains the lead on all but one dataset (ClinTox), where pre-training approaches benefit from transfer of toxicophore patterns.

4.3 Ablation Study

Table 2 ablates HiCoGNN components. Removing the scaffold level (−L2) causes the largest accuracy drop (−2.9%), underscoring the importance of global molecular context. Removing level-specific augmentations (−Chem. Aug.) and replacing with random atom masking across all levels reduces performance by 1.7%, confirming the value of chemically-aware augmentation. Removing the inter-level message passing (−ILP) reduces accuracy by 2.1%, demonstrating that cross-level interaction is essential.`,
    },
    {
      id: "s5",
      number: "5",
      title: "Conclusion",
      content: `We introduced HiCoGNN, a hierarchical contrastive graph learning framework for few-shot molecular property prediction. By constructing three-level molecular hierarchies and applying level-specific contrastive objectives with chemically-aware augmentations, HiCoGNN learns transferable representations that generalize from as few as five labeled examples across diverse property prediction tasks.

Our empirical results demonstrate consistent improvements over prior GNN-based few-shot methods and pre-training approaches across eleven benchmark datasets. Ablation studies confirm that each component—hierarchical construction, multi-level contrastive learning, and inter-level message passing—contributes meaningfully to the overall performance.

Limitations include the reliance on the SMARTS-based functional group vocabulary, which may not fully capture novel chemical motifs, and the computational overhead of constructing multi-level hierarchies at inference time. Future work will explore learned hierarchy construction and extension to regression tasks with continuous property labels.

We anticipate that HiCoGNN will prove particularly valuable in early-stage drug discovery, where experimental throughput is limited and rapid screening across novel chemical space is essential. Code and pre-trained models are available at https://github.com/epfl-cbl/HiCoGNN.`,
    },
  ],

  figures: [
    {
      id: "f1",
      number: 1,
      caption: "AUC-ROC performance comparison under 5-shot and 10-shot settings across classification benchmarks. HiCoGNN (blue) consistently outperforms baselines at both data regimes. Error bars indicate 95% confidence intervals over 5 random seeds.",
      placeholder: "#dbeafe",
      src: DEMO_FIGURE_ASSETS.springer[0],
    },
    {
      id: "f2",
      number: 2,
      caption: "Schematic of the HiCoGNN architecture. (a) Three-level molecular hierarchy construction from a SMILES string. (b) Level-specific GNN encoders with inter-level message passing. (c) Multi-level contrastive objectives applied during pre-training. (d) MAML outer loop for few-shot adaptation.",
      placeholder: "#dcfce7",
      src: DEMO_FIGURE_ASSETS.springer[1],
    },
    {
      id: "f3",
      number: 3,
      caption: "t-SNE visualization of molecular embeddings from HiCoGNN (right) versus flat GNN baseline (left) on the BACE dataset. HiCoGNN embeddings exhibit cleaner class separation and more semantically meaningful clustering of similar scaffold families.",
      placeholder: "#fef9c3",
      src: DEMO_FIGURE_ASSETS.springer[2],
    },
  ],

  tables: [
    {
      id: "t1",
      number: 1,
      caption: "Mean AUC-ROC (%) under 5-shot evaluation across classification benchmarks. Best results in bold; second-best underlined. Results averaged over 5 random meta-test seeds.",
      headers: ["Method", "Tox21", "SIDER", "MUV", "BBBP", "BACE", "Mean"],
      rows: [
        { cells: ["RF + Morgan", "73.4", "58.2", "61.7", "70.3", "75.1", "67.7"] },
        { cells: ["MPNN (full data)", "81.2", "63.8", "71.4", "79.6", "80.2", "75.2"] },
        { cells: ["GROVER (pre-train)", "79.4", "68.1", "74.8", "80.1", "82.4", "77.0"] },
        { cells: ["Meta-MGNN", "81.6", "70.3", "76.2", "81.8", "83.7", "80.4"] },
        { cells: ["HiCoGNN (ours)", "84.1", "74.2", "81.5", "83.7", "86.2", "84.7"] },
      ],
    },
    {
      id: "t2",
      number: 2,
      caption: "Ablation study results on four representative benchmarks under 5-shot protocol. Δ shows performance drop relative to full HiCoGNN.",
      headers: ["Variant", "Tox21", "SIDER", "MUV", "BACE", "Δ Mean"],
      rows: [
        { cells: ["Full HiCoGNN", "84.1", "74.2", "81.5", "86.2", "—"] },
        { cells: ["−Scaffold level (−L2)", "81.3", "71.4", "78.8", "83.1", "−2.9"] },
        { cells: ["−Chem. Aug.", "82.5", "72.4", "79.8", "84.5", "−1.7"] },
        { cells: ["−Inter-level pass (−ILP)", "81.8", "72.1", "79.3", "84.0", "−2.1"] },
        { cells: ["−All (flat GNN + MAML)", "79.2", "68.9", "74.1", "81.2", "−6.6"] },
      ],
    },
  ],

  references: [
    "Altae-Tran, H., Ramsundar, B., Pappu, A.S., Pande, V.: Low data drug discovery with one-shot learning. ACS Central Sci. 3(4), 283–293 (2017)",
    "Finn, C., Abbeel, P., Levine, S.: Model-agnostic meta-learning for fast adaptation of deep networks. In: ICML, pp. 1126–1135 (2017)",
    "Gilmer, J., Schütt, K., Reif, M., Vinyals, O., Kohl, S., Brendel, W.: Neural message passing for quantum chemistry. In: ICML, pp. 1263–1272 (2017)",
    "Guo, Z., Zhang, C., Yu, W., Herr, J., Wiest, O., Jiang, M., Chawla, N.V.: Few-shot graph learning for molecular property prediction. In: WWW, pp. 2559–2567 (2021)",
    "Hu, W., Liu, B., Gomes, J., Zitnik, M., Liang, P., Pande, V., Leskovec, J.: Strategies for pre-training graph neural networks. In: ICLR (2020)",
    "Rong, Y., Bian, Y., Xu, T., Xie, W., Wei, Y., Huang, W., Huang, J.: GROVER: Self-supervised message passing transformer on large-scale molecular data. In: NeurIPS (2020)",
    "Snell, J., Swersky, K., Zemel, R.: Prototypical networks for few-shot learning. In: NeurIPS, pp. 4077–4087 (2017)",
    "Wang, Y., Abuduweili, A., Yao, Q., Dou, D.: Property-aware relation networks for few-shot molecular property prediction. In: NeurIPS (2021)",
    "Wang, Y., Wang, J., Cao, Z., Farimani, A.B.: Molecular contrastive learning of representations via graph neural networks. Nat. Mach. Intell. 4, 279–287 (2022)",
    "Wu, Z., Ramsundar, B., Feinberg, E.N., Gomes, J., Geniesse, C., Pappu, A.S., Leswing, K., Pande, V.: MoleculeNet: A benchmark for molecular machine learning. Chem. Sci. 9(2), 513–530 (2018)",
    "Xiong, Z., Wang, D., Liu, X., Zhong, F., Wan, X., Li, X., Li, Z., Luo, X., Chen, K., Jiang, H., Zheng, M.: Pushing the boundaries of molecular representation for drug discovery with graph attention mechanism. J. Med. Chem. 63(16), 8749–8760 (2020)",
    "Yang, K., Swanson, K., Jin, W., Coley, C., Eiden, P., Gao, H., Guzman-Perez, A., Hopper, T., Kelley, B., Mathea, M.: Analyzing learned molecular representations for property prediction. J. Chem. Inf. Model. 59(8), 3370–3388 (2019)",
  ],

  fontSize: 10,
  lineSpacing: 1.5,
  citationStyle: "Springer",
};
