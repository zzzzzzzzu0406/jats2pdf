export interface IEEEAuthor {
  name: string;
  member?: string; // e.g. "Senior Member, IEEE"
  affiliation: string;
  email?: string;
  corresponding?: boolean;
}

export interface IEEESection {
  id: string;
  number: string;
  title: string;
  content: string; // paragraphs separated by \n\n
}

export interface IEEEFigure {
  id: string;
  number: number;
  caption: string;
  placeholder: string;
  width?: "full" | "half";
}

export interface IEEETable {
  id: string;
  number: number;
  caption: string;
  headers: string[];
  rows: { cells: string[] }[];
}

export interface IEEEEquation {
  id: string;
  number: number;
  latex: string;
  display: string; // rendered text fallback
}

export interface IEEEPaperData {
  // journal metadata
  journal: string;
  journalAbbrev: string;
  volume: string;
  issue: string;
  year: string;
  pages: string;
  doi: string;
  received: string;
  revised?: string;
  accepted: string;
  published: string;
  digitalObjectId: string;

  // article
  title: string;
  authors: IEEEAuthor[];
  abstract: string;
  indexTerms: string[];

  // body
  sections: IEEESection[];
  figures: IEEEFigure[];
  tables: IEEETable[];
  equations: IEEEEquation[];
  references: string[];

  // editor state
  fontSize: number;
  lineSpacing: number;
  marginSize: "narrow" | "normal" | "wide";
  citationStyle: "IEEE" | "APA" | "Vancouver";
}

export const IEEE_DEMO: IEEEPaperData = {
  journal: "IEEE Transactions on Neural Networks and Learning Systems",
  journalAbbrev: "IEEE TRANS. NEURAL NETW. LEARN. SYST.",
  volume: "35",
  issue: "8",
  year: "2024",
  pages: "10842–10857",
  doi: "10.1109/TNNLS.2024.3401582",
  received: "12 January 2024",
  revised: "28 March 2024",
  accepted: "15 May 2024",
  published: "3 June 2024",
  digitalObjectId: "10.1109/TNNLS.2024.3401582",

  title: "Adaptive Federated Learning With Heterogeneous Data Distributions: A Convergence-Guaranteed Framework for Edge Intelligence",

  authors: [
    {
      name: "Wei Zhang",
      member: "Senior Member, IEEE",
      affiliation: "School of Computer Science and Engineering, Southeast University, Nanjing 210096, China",
      email: "w.zhang@seu.edu.cn",
      corresponding: true,
    },
    {
      name: "Liang Chen",
      member: "Member, IEEE",
      affiliation: "Department of Electrical Engineering, Tsinghua University, Beijing 100084, China",
    },
    {
      name: "Priya Ravi",
      affiliation: "School of Informatics, University of Edinburgh, Edinburgh EH8 9AB, U.K.",
    },
    {
      name: "Marco Delgado",
      member: "Fellow, IEEE",
      affiliation: "Department of Computer Science, ETH Zürich, 8092 Zürich, Switzerland",
      email: "m.delgado@inf.ethz.ch",
    },
  ],

  abstract: `Federated learning (FL) enables collaborative model training across distributed edge devices without sharing raw data, making it a promising paradigm for privacy-preserving AI. However, the heterogeneity of data distributions among clients—commonly referred to as statistical heterogeneity—poses a significant challenge to convergence stability and model accuracy. In this article, we propose AdaFedge, an adaptive federated learning framework that dynamically adjusts client-side learning rates and aggregation weights based on a novel heterogeneity metric derived from gradient divergence analysis. We formally prove convergence guarantees under non-convex loss landscapes for both IID and non-IID settings. Extensive experiments on CIFAR-10, CIFAR-100, and a real-world medical imaging dataset demonstrate that AdaFedge achieves up to 4.7% higher test accuracy and 2.3× faster convergence compared to FedAvg, FedProx, and SCAFFOLD baselines. Our framework introduces negligible communication overhead (< 0.3%) while significantly improving fairness across heterogeneous client distributions.`,

  indexTerms: [
    "Federated learning",
    "edge intelligence",
    "data heterogeneity",
    "convergence analysis",
    "gradient divergence",
    "privacy-preserving machine learning",
    "distributed optimization",
  ],

  sections: [
    {
      id: "s1",
      number: "I",
      title: "Introduction",
      content: `The proliferation of Internet-of-Things (IoT) devices and mobile platforms has generated unprecedented volumes of distributed data at the network edge. Federated learning (FL) [1], originally proposed by McMahan et al., offers a compelling solution by enabling model training across distributed clients without centralizing sensitive data. This paradigm has attracted substantial interest in applications ranging from keyboard prediction [2] to healthcare diagnostics [3].

Despite its promise, FL faces a fundamental challenge when client data distributions diverge significantly—a condition termed statistical heterogeneity or non-IID data. Under such conditions, the canonical FedAvg algorithm suffers from client drift, whereby local models diverge from the global optimum during local training, leading to degraded convergence and reduced accuracy [4]. The severity of this phenomenon scales with the degree of distribution divergence and the number of local training steps.

Prior work has addressed this challenge through several directions: (1) modifying the local objective with proximal terms (FedProx [5]), (2) controlling variance through auxiliary variables (SCAFFOLD [6]), and (3) applying meta-learning principles (MAML-FL [7]). While effective, these methods often introduce fixed hyperparameters that must be tuned per dataset, limiting their adaptability in dynamic edge environments.

In this work, we propose AdaFedge—an Adaptive Federated Learning Framework for Edge Intelligence—that overcomes these limitations through dynamic, gradient-divergence-guided adaptation. Our key contributions are as follows:

1) We introduce a client-side heterogeneity metric $\mathcal{H}_k$ computed from gradient statistics that quantifies distribution divergence without sharing raw data.

2) We design an adaptive aggregation mechanism that reweights client updates proportional to their estimated data quality and heterogeneity score.

3) We provide rigorous convergence proofs for non-convex objectives under both IID and non-IID settings with bounded gradient dissimilarity.

4) Through extensive empirical evaluation, we demonstrate consistent improvements over state-of-the-art FL baselines.`,
    },
    {
      id: "s2",
      number: "II",
      title: "Related Work",
      content: `Federated learning was formalized by McMahan et al. [1] with the FedAvg algorithm, which performs multiple rounds of local stochastic gradient descent (SGD) before aggregating parameters. While efficient in communication, FedAvg assumes relatively homogeneous data across clients—an assumption rarely satisfied in practice.

Statistical heterogeneity in FL has been studied extensively. Li et al. [5] proposed FedProx, which adds a proximal term to the local objective to prevent client drift. Karimireddy et al. [6] introduced SCAFFOLD, leveraging control variates to correct for gradient bias. FedNova [8] addresses objective inconsistency by normalizing local updates before aggregation. While these methods yield improvements, they rely on fixed regularization coefficients that may not generalize across tasks.

Personalized FL [9] approaches the heterogeneity problem differently by training per-client models rather than a single global model. Methods such as pFedMe [10] and Ditto [11] balance local and global objectives through bi-level optimization. However, personalized FL requires additional inference infrastructure at each client, which may be prohibitive for resource-constrained edge devices.

Our work is most closely related to adaptive optimization in FL. FedAdam [12] and FedYogi [13] apply adaptive server-side optimizers to improve convergence. In contrast, AdaFedge operates at the client level, dynamically adjusting learning rates based on measured heterogeneity—a complementary and orthogonal direction.`,
    },
    {
      id: "s3",
      number: "III",
      title: "Problem Formulation",
      content: `Consider a federated system with $N$ clients, each holding a local dataset $\mathcal{D}_k = \{(\mathbf{x}_i, y_i)\}_{i=1}^{n_k}$ drawn from a client-specific distribution $P_k$. The global objective is to minimize:

$$F(\mathbf{w}) = \sum_{k=1}^{N} p_k F_k(\mathbf{w}), \quad p_k = \frac{n_k}{\sum_j n_j}$$

where $F_k(\mathbf{w}) = \mathbb{E}_{(\mathbf{x},y)\sim P_k}[\ell(\mathbf{w}; \mathbf{x}, y)]$ is the local loss function for client $k$ and $\ell$ is a smooth loss satisfying standard regularity conditions.

The challenge of non-IID data arises when $P_k \neq P_j$ for $k \neq j$, causing the local minima $\mathbf{w}_k^* = \arg\min_\mathbf{w} F_k(\mathbf{w})$ to diverge from the global optimum $\mathbf{w}^* = \arg\min_\mathbf{w} F(\mathbf{w})$.

We quantify this divergence through the gradient dissimilarity bound $\kappa$, defined as:

$$\kappa^2 = \frac{1}{N}\sum_{k=1}^{N} \|\nabla F_k(\mathbf{w}) - \nabla F(\mathbf{w})\|^2$$

The proposed heterogeneity metric $\mathcal{H}_k$ at round $t$ is computed locally as the exponential moving average of successive gradient norms, providing a lightweight proxy for $\kappa$ without requiring global information.`,
    },
    {
      id: "s4",
      number: "IV",
      title: "The AdaFedge Framework",
      content: `AdaFedge consists of three tightly integrated components: (1) a local heterogeneity estimator, (2) an adaptive learning rate scheduler, and (3) a quality-weighted aggregation protocol.

A. Local Heterogeneity Estimator. At the beginning of each communication round, client $k$ computes the gradient $\mathbf{g}_k^{(t)} = \nabla F_k(\mathbf{w}^{(t)})$ on a small validation batch. The heterogeneity metric is updated as:

$$\mathcal{H}_k^{(t)} = \beta \mathcal{H}_k^{(t-1)} + (1-\beta)\|\mathbf{g}_k^{(t)} - \bar{\mathbf{g}}^{(t-1)}\|^2$$

where $\bar{\mathbf{g}}^{(t-1)}$ is the global gradient approximation from the previous round and $\beta = 0.9$ is the momentum coefficient.

B. Adaptive Learning Rate Scheduler. The per-client learning rate is adjusted inversely proportional to heterogeneity:

$$\eta_k^{(t)} = \frac{\eta_0}{\sqrt{1 + \gamma \mathcal{H}_k^{(t)}}}$$

where $\eta_0$ is the base learning rate and $\gamma > 0$ is a scaling factor. Clients with higher heterogeneity scores receive reduced learning rates, preventing aggressive local updates that would amplify drift.

C. Quality-Weighted Aggregation. After local training, the server aggregates updates as:

$$\mathbf{w}^{(t+1)} = \sum_{k \in \mathcal{S}^{(t)}} \alpha_k^{(t)} \mathbf{w}_k^{(t)}$$

where $\mathcal{S}^{(t)}$ is the set of participating clients and the aggregation weights $\alpha_k^{(t)}$ are computed from a softmax over inverse heterogeneity scores to favor clients whose distributions better align with the global objective.`,
    },
    {
      id: "s5",
      number: "V",
      title: "Convergence Analysis",
      content: `We establish convergence guarantees for AdaFedge under the following standard assumptions: (A1) $L$-smoothness of $F_k$; (A2) unbiased stochastic gradients with bounded variance $\sigma^2$; (A3) bounded gradient dissimilarity with constant $\kappa$; (A4) clients participate with probability $q > 0$ per round.

Theorem 1 (Convergence of AdaFedge): Under assumptions A1–A4, with adaptive learning rates $\{\eta_k^{(t)}\}$ as defined in Section IV and $E$ local steps per round, after $T$ communication rounds:

$$\frac{1}{T}\sum_{t=0}^{T-1}\mathbb{E}\|\nabla F(\mathbf{w}^{(t)})\|^2 \leq \mathcal{O}\left(\frac{F_0}{\sqrt{T}} + \frac{\kappa^2 E \sigma^2}{T}\right)$$

where $F_0 = F(\mathbf{w}^{(0)}) - F(\mathbf{w}^*)$ denotes the initial optimality gap. The proof relies on carefully bounding the drift accumulated over $E$ local steps using the adaptive learning rate, yielding a tighter constant than FedProx for large $\kappa$.

Corollary 1: When data is IID ($\kappa = 0$), AdaFedge recovers the convergence rate of vanilla SGD, ensuring no degradation in the homogeneous setting.

These results confirm that AdaFedge achieves $\mathcal{O}(1/\sqrt{T})$ convergence for non-convex objectives, matching the theoretical guarantees of FedAvg under IID data while improving empirical performance under non-IID conditions.`,
    },
    {
      id: "s6",
      number: "VI",
      title: "Experiments",
      content: `We evaluate AdaFedge against FedAvg [1], FedProx [5], SCAFFOLD [6], and FedNova [8] across three benchmarks.

A. Experimental Setup. We simulate a federated system with $N = 100$ clients, of which a random $10\%$ participate per round. Non-IID partitioning follows the Dirichlet distribution with concentration $\alpha_{\text{Dir}} \in \{0.1, 0.5, 1.0\}$, where smaller values represent more severe heterogeneity. All methods use the same ResNet-20 backbone on CIFAR-10/100 and a lightweight MobileNetV2 on the chest X-ray dataset. Communication rounds are fixed at 500 with $E = 5$ local epochs.

B. Main Results. Table I summarizes top-1 accuracy at convergence. AdaFedge achieves the highest accuracy across all heterogeneity levels, with the largest margin ($+4.7\%$ over FedAvg) observed under $\alpha_{\text{Dir}} = 0.1$ on CIFAR-100, corresponding to the most extreme non-IID scenario. Fig. 1 plots validation accuracy curves, showing AdaFedge reaches 90\% of its converged accuracy 2.3× faster than FedAvg.

C. Ablation Study. We ablate the three components of AdaFedge in Table II: removing the adaptive learning rate (−ALR) degrades accuracy by 2.1\%, removing quality weighting (−QW) by 1.8\%, and removing the heterogeneity estimator (−HE) by 3.4\%. These results confirm that each component contributes meaningfully.

D. Communication Overhead. The heterogeneity metric $\mathcal{H}_k$ adds only a scalar per client per round, incurring $< 0.3\%$ communication overhead relative to model parameter transmission, making AdaFedge practical for bandwidth-constrained edge deployments.`,
    },
    {
      id: "s7",
      number: "VII",
      title: "Conclusion",
      content: `We presented AdaFedge, an adaptive federated learning framework that addresses statistical heterogeneity through dynamic, gradient-divergence-guided adaptation. By introducing a lightweight heterogeneity metric and designing adaptive learning rates and quality-weighted aggregation around it, AdaFedge achieves rigorous convergence guarantees while delivering consistent empirical improvements over existing FL baselines.

Our convergence analysis establishes $\mathcal{O}(1/\sqrt{T})$ rates for non-convex objectives under non-IID data, matching vanilla SGD in the IID case. Experiments across CIFAR-10, CIFAR-100, and medical imaging datasets validate the framework's effectiveness, with up to 4.7\% accuracy improvement and 2.3× faster convergence.

Future work will explore extending AdaFedge to asynchronous communication protocols and investigating its interaction with differential privacy mechanisms for enhanced security guarantees.`,
    },
  ],

  figures: [
    {
      id: "f1",
      number: 1,
      caption: "Validation accuracy curves on CIFAR-100 ($\\alpha_{\\text{Dir}} = 0.1$, $N = 100$ clients) over 500 communication rounds. AdaFedge reaches 90% of its converged accuracy 2.3× faster than FedAvg.",
      placeholder: "#dbeafe",
      width: "full",
    },
    {
      id: "f2",
      number: 2,
      caption: "Architecture of the AdaFedge framework. Each client computes a local heterogeneity metric $\\mathcal{H}_k$ and adapts its learning rate before performing local SGD. The server aggregates updates using quality weights derived from $\\mathcal{H}_k$.",
      placeholder: "#dcfce7",
      width: "full",
    },
    {
      id: "f3",
      number: 3,
      caption: "Effect of the Dirichlet concentration parameter $\\alpha_{\\text{Dir}}$ on AdaFedge vs. baselines. Lower $\\alpha_{\\text{Dir}}$ corresponds to more severe data heterogeneity.",
      placeholder: "#fef9c3",
      width: "half",
    },
  ],

  tables: [
    {
      id: "t1",
      number: 1,
      caption: "Top-1 Test Accuracy (%) on Three Benchmarks Under Dirichlet Non-IID Partitioning",
      headers: ["Method", "CIFAR-10 α=0.1", "CIFAR-10 α=0.5", "CIFAR-100 α=0.1", "CIFAR-100 α=0.5", "Medical (α=0.1)"],
      rows: [
        { cells: ["FedAvg [1]", "72.3", "81.4", "44.1", "55.8", "78.2"] },
        { cells: ["FedProx [5]", "74.1", "82.6", "46.3", "57.2", "79.8"] },
        { cells: ["SCAFFOLD [6]", "75.8", "83.9", "48.0", "58.4", "81.1"] },
        { cells: ["FedNova [8]", "76.2", "84.1", "48.6", "59.0", "81.7"] },
        { cells: ["AdaFedge (ours)", "78.9", "85.3", "51.4", "61.6", "83.9"] },
      ],
    },
    {
      id: "t2",
      number: 2,
      caption: "Ablation Study: Top-1 Accuracy (%) on CIFAR-100 ($\\alpha_{\\text{Dir}} = 0.1$)",
      headers: ["Variant", "Adaptive LR", "Quality Weighting", "Heterogeneity Est.", "Accuracy (%)"],
      rows: [
        { cells: ["Full AdaFedge", "✓", "✓", "✓", "51.4"] },
        { cells: ["−ALR", "✗", "✓", "✓", "49.3"] },
        { cells: ["−QW", "✓", "✗", "✓", "49.6"] },
        { cells: ["−HE", "✓", "✓", "✗", "48.0"] },
        { cells: ["−ALR, −QW, −HE", "✗", "✗", "✗", "44.1"] },
      ],
    },
  ],

  equations: [
    { id: "eq1", number: 1, latex: "F(\\mathbf{w}) = \\sum_{k=1}^{N} p_k F_k(\\mathbf{w})", display: "F(w) = Σₖ pₖ Fₖ(w)" },
    { id: "eq2", number: 2, latex: "\\eta_k^{(t)} = \\frac{\\eta_0}{\\sqrt{1 + \\gamma \\mathcal{H}_k^{(t)}}}", display: "ηₖ(t) = η₀ / √(1 + γ·Hₖ(t))" },
    { id: "eq3", number: 3, latex: "\\mathbf{w}^{(t+1)} = \\sum_{k \\in \\mathcal{S}^{(t)}} \\alpha_k^{(t)} \\mathbf{w}_k^{(t)}", display: "w(t+1) = Σₖ αₖ(t) · wₖ(t)" },
  ],

  references: [
    "[1] H. B. McMahan, E. Moore, D. Ramage, S. Hampson, and B. A. y Arcas, \"Communication-efficient learning of deep networks from decentralized data,\" in Proc. AISTATS, 2017, pp. 1273–1282.",
    "[2] A. Hard et al., \"Federated learning for mobile keyboard prediction,\" arXiv:1811.03604, 2018.",
    "[3] R. A. Miotto, F. Wang, S. Wang, X. Jiang, and J. T. Dudley, \"Deep learning for healthcare: Review, opportunities and challenges,\" Briefings Bioinf., vol. 19, no. 6, pp. 1236–1246, 2018.",
    "[4] X. Li, K. Huang, W. Yang, S. Wang, and Z. Zhang, \"On the convergence of FedAvg on non-IID data,\" in Proc. ICLR, 2020.",
    "[5] T. Li, A. K. Sahu, M. Zaheer, M. Sanjabi, A. Talwalkar, and V. Smith, \"Federated optimization in heterogeneous networks,\" in Proc. MLSys, 2020.",
    "[6] S. P. Karimireddy, S. Kale, M. Mohri, S. J. Reddi, S. U. Stich, and A. T. Suresh, \"SCAFFOLD: Stochastic controlled averaging for federated learning,\" in Proc. ICML, 2020.",
    "[7] C. Fallah, A. Mokhtari, and A. Ozdaglar, \"Personalized federated learning with theoretical guarantees: A model-agnostic meta-learning approach,\" in Proc. NeurIPS, 2020.",
    "[8] J. Wang, Q. Liu, H. Liang, G. Joshi, and H. V. Poor, \"Tackling the objective inconsistency problem in heterogeneous federated optimization,\" in Proc. NeurIPS, 2020.",
    "[9] Y. Mansour, M. Mohri, J. Ro, and A. T. Suresh, \"Three approaches for personalization with applications to federated learning,\" arXiv:2002.10619, 2020.",
    "[10] C. T. Dinh, N. H. Tran, and J. Nguyen, \"Personalized federated learning with Moreau envelopes,\" in Proc. NeurIPS, 2020.",
    "[11] T. Li, S. Hu, A. Beirami, and V. Smith, \"Ditto: Fair and robust federated learning through personalization,\" in Proc. ICML, 2021.",
    "[12] S. J. Reddi, Z. Charles, M. Zaheer, Z. Garrett, K. Rush, J. Konecny, S. Kumar, and H. B. McMahan, \"Adaptive federated optimization,\" in Proc. ICLR, 2021.",
    "[13] S. J. Reddi et al., \"FedYogi: Adaptive methods for federated learning,\" arXiv:2003.00295, 2020.",
  ],

  fontSize: 10,
  lineSpacing: 1.15,
  marginSize: "normal",
  citationStyle: "IEEE",
};
