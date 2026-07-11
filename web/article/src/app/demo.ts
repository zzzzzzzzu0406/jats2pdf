import type { PaperData } from "./types";

export const DEMO: PaperData = {
  journal: "Expert Systems with Applications",
  journalZh: "专家系统与应用",
  issn: "0957-4174",
  doi: "10.1016/j.eswa.2024.124891",
  volume: "Vol. 255, Part A",
  year: "2024",
  pages: "124891",
  received: "15 November 2023",
  revised: "3 March 2024",
  accepted: "18 April 2024",
  title: {
    en: "Intelligent Typesetting Engine for Academic Publishing: Automated Mapping and Generation from JATS XML Structured Data to PDF Layout",
    zh: "面向学术出版的智能排版引擎：从 JATS XML 结构化数据到 PDF 版面的自动化映射与生成",
  },
  authors: [
    { name: "Zhang Mingyuan", nameZh: "张明远", affKeys: "a,b", email: "zhang@pku.edu.cn" },
    { name: "Li Siyuan",      nameZh: "李思远", affKeys: "c" },
    { name: "Wang Jianguo",   nameZh: "王建国", affKeys: "a" },
    { name: "Chen Xiaohua",   nameZh: "陈晓华", affKeys: "d" },
  ],
  affiliations: [
    { key: "a", text: "Dept. of Computer Science & Technology, Peking University, Beijing 100871, China", textZh: "北京大学计算机科学与技术系，北京 100871" },
    { key: "b", text: "State Key Laboratory of General Artificial Intelligence, Beijing, China", textZh: "通用人工智能国家重点实验室，北京" },
    { key: "c", text: "Institute of Computing Technology, CAS, Beijing 100190, China", textZh: "中国科学院计算技术研究所，北京 100190" },
    { key: "d", text: "School of Software, Tsinghua University, Beijing 100084, China", textZh: "清华大学软件学院，北京 100084" },
  ],
  highlights: [
    "A semantics-aware three-stage pipeline maps JATS XML to professional PDF layouts.",
    "Constraint satisfaction planning balances compactness, balance and rule compliance.",
    "KaTeX-based MathML rendering achieves 96.2% formula accuracy.",
    "Single/double-column switching with automatic column balancing (Δ ≤ 5%).",
    "Achieves 93.7% layout quality vs. professional human typesetting at 0.9 s/page.",
  ],
  highlightsZh: [
    "语义感知三阶段流水线将 JATS XML 映射为专业 PDF 版面。",
    "约束满足规划在紧凑性、平衡性和规则合规性之间寻优。",
    "基于 KaTeX 的 MathML 渲染公式精度达 96.2%。",
    "单/双栏自动切换，栏间平衡约束 Δ ≤ 5%。",
    "0.9 秒/页速度下版面质量达专业人工排版的 93.7%。",
  ],
  abstract: {
    en: "Automatic transformation of structured JATS XML documents into high-quality PDF layouts is a research challenge combining theoretical depth with significant engineering complexity. We present the Intelligent Typesetting Engine (ITE), a semantics-aware system that extracts structural information from hierarchical JATS XML nodes and maps them to precise layout specifications via a constraint-optimization pipeline. The system handles body paragraphs, hierarchical headings, mathematical formulae, figures, tables, and references. It supports dynamic single/double-column switching, cross-page figure handling, automatic formula line-breaking, and header/footer generation. Experiments on 487 papers across computer science, mathematics and physics demonstrate that ITE achieves 93.7% layout quality parity with professional human typesetters at 0.9 s/page, significantly outperforming existing baselines including WeasyPrint (71.2%), Apache FOP (74.8%) and iText (79.3%).",
    zh: "将结构化的 JATS XML 文档自动转换为高质量 PDF 版面是一项兼具理论深度与工程挑战的研究课题。本文提出智能排版引擎（ITE），一种能够从层次化 JATS XML 节点中提取结构信息并通过约束优化流水线映射为精确版面规格的语义感知系统。系统处理正文段落、层次标题、数学公式、图表及参考文献，支持单/双栏动态切换、跨页图表处理、长公式自动换行及页眉页脚生成。在跨计算机科学、数学和物理学领域 487 篇论文上的实验表明，ITE 以 0.9 秒/页的处理速度达到了专业人工排版 93.7% 的版面质量，显著优于 WeasyPrint（71.2%）、Apache FOP（74.8%）和 iText（79.3%）等现有基线方法。",
  },
  keywords: {
    en: ["Intelligent typesetting", "JATS XML", "PDF layout generation", "Academic publishing", "Constraint satisfaction", "MathML rendering"],
    zh: ["智能排版", "JATS XML", "PDF 版面生成", "学术出版", "约束满足", "MathML 渲染"],
  },
  sections: [
    {
      id: "s1", number: "1", title: { en: "Introduction", zh: "引言" },
      content: {
        en: "The accelerating digitisation of academic publishing has placed enormous pressure on traditional manual typesetting workflows. The Journal Article Tag Suite (JATS) XML standard [1] provides a semantically rich, machine-readable representation of scholarly articles. However, automatically mapping an XML semantic tree to a precise PDF layout requires complex typographic rule inference and multi-dimensional constraint solving — a longstanding challenge in the field.\n\nPrior work falls into two categories. Rule-based template-driven approaches [2,3] achieve automation in limited scenarios via predefined rules but lack flexibility for cross-page and complex formula scenarios. Machine learning methods [4,5] attempt to learn layout decisions from human-typeset corpora but face data scarcity and interpretability challenges. Neither category provides a principled solution for the full JATS-to-PDF pipeline.\n\nThis paper proposes the Intelligent Typesetting Engine (ITE), which integrates semantics-aware parsing, constraint-optimised layout planning, and high-fidelity rendering into a unified end-to-end pipeline (Fig. 1). Our main contributions are: (i) a formal constraint satisfaction formulation of the layout problem; (ii) a KaTeX-based MathML rendering pipeline achieving 96.2% formula accuracy; (iii) an automatic column-balance algorithm for double-column mode; and (iv) empirical evaluation on a 487-paper benchmark demonstrating near-professional quality.",
        zh: "学术出版数字化进程的加速对传统人工排版工作流产生了巨大压力。JATS XML 标准[1]为学术论文提供了语义丰富的机器可读表示，然而将 XML 语义树自动映射为精确 PDF 版面需要复杂的排版规则推理和多维约束求解，长期以来是该领域的研究难点。\n\n现有研究主要分为两类：基于规则的模板驱动方法[2,3]通过预定义规则实现有限场景的自动化，但缺乏对跨页和复杂公式场景的处理灵活性；基于机器学习的方法[4,5]尝试从人工排版语料中学习版面决策，但面临数据稀缺和可解释性差的挑战。\n\n本文提出智能排版引擎（ITE），将语义感知解析、约束优化版面规划和高保真渲染融合为统一的端到端流水线（见图1）。主要贡献包括：(i) 版面问题的约束满足形式化；(ii) 基于 KaTeX 的 MathML 渲染管线，公式精度达 96.2%；(iii) 双栏模式的自动栏间平衡算法；(iv) 在 487 篇论文基准上的实验评估，展示了接近专业排版的质量水平。",
      },
      subsections: [],
    },
    {
      id: "s2", number: "2", title: { en: "Related Work", zh: "相关工作" },
      content: {
        en: "Document layout analysis and automated typesetting have been studied from both algorithmic and learning-based perspectives. Knuth and Plass [3] established the theoretical foundation for line-breaking algorithms, formalising the problem as dynamic programming over badness metrics. Their approach, implemented in TeX, remains the gold standard for paragraph layout. Subsequent work extended this to multi-column and justified text [6].\n\nPubLayNet [4] introduced a large-scale benchmark for document layout analysis using deep learning, demonstrating that convolutional neural networks could segment page regions with high accuracy. DocBank [5] extended this to token-level annotation. However, these works address layout understanding, not generation.\n\nFor generation, WeasyPrint [7] renders HTML/CSS to PDF using the CSS box model, achieving reasonable results for single-column documents but lacking support for complex academic typographic constraints. Apache FOP [8] implements the XSL-FO standard but requires manual XSL-FO authoring. iText [9] provides programmatic PDF generation but requires explicit coordinate specification. None of these systems operates directly on JATS XML with full semantic understanding.",
        zh: "文档版面分析与自动排版已从算法和基于学习的视角进行了广泛研究。Knuth 和 Plass [3] 为换行算法奠定了理论基础，将其形式化为基于不良度度量的动态规划问题。该方法在 TeX 中实现，至今仍是段落排版的黄金标准。后续工作将其扩展至多栏和两端对齐文本[6]。\n\nPubLayNet [4] 利用深度学习引入了大规模文档版面分析基准，表明卷积神经网络可以高精度分割页面区域。DocBank [5] 将其扩展至词元级标注。然而这些工作针对版面理解而非生成。\n\n在生成方面，WeasyPrint [7] 利用 CSS 盒模型将 HTML/CSS 渲染为 PDF，对单栏文档效果合理，但缺乏对复杂学术排版约束的支持。Apache FOP [8] 实现了 XSL-FO 标准但需要手动编写 XSL-FO。iText [9] 提供程序化 PDF 生成但需要显式坐标规范。这些系统均不能直接在具有完整语义理解的 JATS XML 上运行。",
      },
      subsections: [],
    },
    {
      id: "s3", number: "3", title: { en: "System Architecture", zh: "系统架构" },
      content: {
        en: "ITE comprises three core modules communicating via a standardised Intermediate Representation (IR): the semantic parser (ITE-Parse), the layout planner (ITE-Layout), and the rendering engine (ITE-Render). Table 1 summarises each module's inputs, outputs and core technology.\n\nITE-Parse performs deep semantic extraction via DOM tree traversal. Beyond plain text extraction, it constructs a Cross-Reference Graph (CRG) that maps every \\\\cite{}, \\\\ref{} and \\\\eqref{} occurrence to its target, enabling automatic figure and table numbering and in-text citation resolution. MathML nodes are forwarded to a dedicated formula submodule that generates a KaTeX abstract syntax tree (AST) for downstream rendering.\n\nITE-Layout formalises layout generation as a Constraint Satisfaction Problem (CSP). The planner receives the semantic IR and searches the layout space subject to constraints including: figures must not straddle section boundaries; display formulae must be centred or inline-aligned; the reference list must begin on a new column. The result is a fully specified layout IR consumed by ITE-Render.\n\nITE-Render translates the layout IR to PDF via Apache PDFBox for text and graphics, and KaTeX for mathematical formulae. The renderer supports both single-column (\\\\textit{columnCount} = 1) and double-column (\\\\textit{columnCount} = 2) output modes.",
        zh: "ITE 由三个通过标准化中间表示（IR）通信的核心模块构成：语义解析器（ITE-Parse）、版面规划器（ITE-Layout）和渲染引擎（ITE-Render）。表1总结了各模块的输入、输出和核心技术。\n\nITE-Parse 通过 DOM 树遍历执行深度语义提取。除纯文本提取外，还构建跨引用关系图（CRG），将每个 \\\\cite{}、\\\\ref{} 和 \\\\eqref{} 出现映射到其目标，实现图表自动编号和文内引用解析。MathML 节点被转发到专用公式子模块，生成 KaTeX 抽象语法树（AST）供下游渲染使用。\n\nITE-Layout 将版面生成形式化为约束满足问题（CSP）。规划器接收语义 IR 并在约束条件下搜索版面空间，约束包括：图表不得跨越章节边界；展示公式必须居中或行内对齐；参考文献列表必须从新栏开始。结果是 ITE-Render 使用的完整规格版面 IR。\n\nITE-Render 通过 Apache PDFBox 处理文本和图形，并通过 KaTeX 处理数学公式，将版面 IR 转换为 PDF。渲染器支持单栏（columnCount = 1）和双栏（columnCount = 2）两种输出模式。",
      },
      subsections: [],
    },
    {
      id: "s4", number: "4", title: { en: "Formal Problem Definition", zh: "形式化问题定义" },
      content: {
        en: "Let the set of semantic nodes extracted from a JATS XML document be 𝒳 = {x₁, x₂, …, xₙ} and the layout specification space be ℒ. Each node xᵢ carries a type τ(xᵢ) ∈ {paragraph, heading, figure, table, equation, reference} and a content payload. The layout mapping function f_map is defined as the minimiser of a weighted layout cost function:\n\n    f_map : 𝒳 → ℒ,  f_map(𝒳) = arg min_{l ∈ ℒ} 𝒞(𝒳, l)             (1)\n\nThe cost function 𝒞(𝒳, l) decomposes into three additive terms:\n\n    𝒞(𝒳, l) = α · 𝒞_c + β · 𝒞_b + γ · 𝒞_v,   α + β + γ = 1         (2)\n\nwhere 𝒞_c is the compactness cost (whitespace utilisation), 𝒞_b is the visual balance cost (column height variance), and 𝒞_v is the constraint violation penalty. In our experiments we set α = 0.3, β = 0.4, γ = 0.3.\n\nIn double-column mode, column balance is enforced via the constraint:\n\n    Δ = |h_L − h_R| / H ≤ δ_max = 0.05                                (3)\n\nwhere h_L and h_R are the left and right column heights respectively and H is the page height. This constraint is incorporated into 𝒞_b. The full CSP is solved by constraint propagation followed by branch-and-bound search, yielding an O(n²) algorithm in practice.",
        zh: "设从 JATS XML 文档中提取的语义节点集合为 𝒳 = {x₁, x₂, …, xₙ}，版面规格空间为 ℒ。每个节点 xᵢ 携带类型 τ(xᵢ) ∈ {段落, 标题, 图, 表, 公式, 参考文献} 和内容载荷。版面映射函数 f_map 定义为加权版面代价函数的最小化：\n\n    f_map : 𝒳 → ℒ,  f_map(𝒳) = arg min_{l ∈ ℒ} 𝒞(𝒳, l)             (1)\n\n代价函数 𝒞(𝒳, l) 分解为三个加和项：\n\n    𝒞(𝒳, l) = α · 𝒞_c + β · 𝒞_b + γ · 𝒞_v,   α + β + γ = 1         (2)\n\n其中 𝒞_c 为紧凑性代价（空白利用率），𝒞_b 为视觉平衡代价（栏高差异），𝒞_v 为约束违反惩罚。实验中设置 α = 0.3、β = 0.4、γ = 0.3。\n\n双栏模式下通过以下约束强制栏间平衡：\n\n    Δ = |h_L − h_R| / H ≤ δ_max = 0.05                                (3)\n\n其中 h_L 和 h_R 分别为左栏和右栏高度，H 为页面高度。该约束纳入 𝒞_b。完整 CSP 通过约束传播后接分支界定搜索求解，实际时间复杂度为 O(n²)。",
      },
      subsections: [],
    },
    {
      id: "s5", number: "5", title: { en: "Experiments", zh: "实验" },
      content: {
        en: "We evaluate ITE on a benchmark of 487 papers from arXiv spanning computer science (CS), mathematics (Math) and physics (Phys). Each paper was independently typeset by a professional typesetter to obtain ground-truth layouts. We compare ITE against four baselines: LaTeX (manual, treated as ceiling), WeasyPrint, Apache FOP, and iText+template.\n\nEvaluation metrics are: Layout Quality Score (LQS) — a composite metric combining whitespace utilisation, line-ending balance, and figure placement quality, normalised to [0,100]; Formula Accuracy (FA) — fraction of formula tokens rendered identically to LaTeX; and Processing Time (PT) in seconds per page.\n\nTable 2 reports results averaged over the full benchmark. ITE achieves LQS = 93.7, surpassing all baselines by a substantial margin. Formula accuracy of 96.2% reflects the effectiveness of the KaTeX pipeline. Processing time of 0.9 s/page is faster than all baselines, attributable to the efficient constraint propagation algorithm.\n\nFig. 2 plots LQS by domain. ITE shows consistent performance across CS (94.1), Math (93.2) and Phys (93.8), indicating domain robustness. Baseline methods show larger domain variance, particularly on Math papers with dense formula content.",
        zh: "我们在来自 arXiv 的 487 篇论文基准上评估 ITE，涵盖计算机科学（CS）、数学（Math）和物理学（Phys）。每篇论文均由专业排版师独立排版以获得真实版面。我们将 ITE 与四个基线进行比较：LaTeX（人工，视为上界）、WeasyPrint、Apache FOP 和 iText+模板。\n\n评估指标为：版面质量分（LQS）——综合空白利用率、行末平衡性和图片放置质量的复合指标，归一化至 [0,100]；公式精度（FA）——公式词元与 LaTeX 渲染一致的比例；处理时间（PT），单位为秒/页。\n\n表2报告了在完整基准上的平均结果。ITE 实现 LQS = 93.7，大幅超越所有基线。96.2% 的公式精度反映了 KaTeX 流水线的有效性。0.9 秒/页的处理时间快于所有基线，归因于高效的约束传播算法。\n\n图2按领域绘制 LQS。ITE 在 CS（94.1）、Math（93.2）和 Phys（93.8）上表现一致，表明领域鲁棒性。基线方法的领域方差更大，尤其在含有大量公式的数学论文上。",
      },
      subsections: [],
    },
    {
      id: "s6", number: "6", title: { en: "Conclusion", zh: "结论" },
      content: {
        en: "We presented ITE, an intelligent typesetting engine that systematically addresses the challenges of automated PDF layout generation from JATS XML. Through three-module collaboration — semantic parsing, constraint-optimised planning, and high-fidelity rendering — ITE achieves near-professional typesetting quality (LQS 93.7%) at 0.9 s/page. The formal CSP formulation provides a principled and interpretable basis for layout decisions, distinguishing our approach from black-box learned methods.\n\nFuture work will focus on: (1) integrating large language models to enhance semantic understanding in layout planning; (2) supporting additional complex elements such as multi-line footnotes, sidebars, and colour plates; (3) extending ITE to incremental typesetting updates for online publishing workflows; and (4) releasing the 487-paper benchmark as an open evaluation resource for the community.",
        zh: "本文提出了智能排版引擎 ITE，系统性地解决了从 JATS XML 自动生成 PDF 版面的挑战。通过语义解析、约束优化规划和高保真渲染三模块协同，ITE 以 0.9 秒/页的速度实现了接近专业水平的排版质量（LQS 93.7%）。形式化的 CSP 表述为版面决策提供了原则性和可解释的基础，使本方法有别于黑盒学习方法。\n\n未来工作将聚焦于：(1) 引入大语言模型增强版面规划中的语义理解；(2) 支持多行脚注、侧边栏和彩色图版等更多复杂元素；(3) 将 ITE 扩展至在线出版工作流的增量式排版更新；(4) 将 487 篇论文基准作为开放评估资源发布给社区。",
      },
      subsections: [],
    },
  ],
  figures: [
    {
      id: "f1", number: 1,
      caption: { en: "Overall architecture of ITE. The three-stage pipeline processes JATS XML through semantic parsing, constraint-optimised layout planning, and high-fidelity PDF rendering.", zh: "ITE 整体架构。三阶段流水线通过语义解析、约束优化版面规划和高保真 PDF 渲染处理 JATS XML。" },
      placeholder: "#dbeafe",
    },
    {
      id: "f2", number: 2,
      caption: { en: "Layout Quality Score (LQS) by domain for ITE and baseline methods. Error bars show standard deviation over 5-fold cross-validation.", zh: "ITE 和基线方法按领域的版面质量分（LQS）。误差线为5折交叉验证的标准差。" },
      placeholder: "#dcfce7",
    },
  ],
  tables: [
    {
      id: "t1", number: 1,
      caption: { en: "ITE module specifications.", zh: "ITE 模块规格。" },
      headers: ["Module", "Input", "Output", "Core Technology"],
      rows: [
        { cells: ["ITE-Parse", "JATS XML", "Semantic IR + CRG", "DOM traversal, MathML"] },
        { cells: ["ITE-Layout", "Semantic IR", "Layout Spec IR", "CSP, branch-and-bound"] },
        { cells: ["ITE-Render", "Layout Spec IR", "PDF Document", "PDFBox, KaTeX"] },
      ],
    },
    {
      id: "t2", number: 2,
      caption: { en: "Experimental results on the 487-paper benchmark. Best automated result in bold.", zh: "487篇论文基准的实验结果，最优自动化结果加粗。" },
      headers: ["Method", "LQS (%)", "FA (%)", "PT (s/page)"],
      rows: [
        { cells: ["LaTeX (manual)", "100.0", "100.0", "—"] },
        { cells: ["WeasyPrint", "71.2", "68.4", "2.1"] },
        { cells: ["Apache FOP", "74.8", "72.1", "3.4"] },
        { cells: ["iText + Template", "79.3", "81.6", "1.8"] },
        { cells: ["ITE (ours)", "93.7†", "96.2†", "0.9†"] },
      ],
    },
  ],
  references: [
    "Lapeyre, D. A. (2010). JATS: Journal Article Tag Suite. NISO Z39.96-2012. National Information Standards Organization.",
    "Pettifer, S., McDermott, P., Marsh, J., Thorne, D., Brady, A., & Biggin, P. C. (2011). Ceci n'est pas un hamburger: modelling and representing the scholarly article. Learned Publishing, 24(3), 207–220.",
    "Knuth, D. E., & Plass, M. F. (1981). Breaking paragraphs into lines. Software: Practice and Experience, 11(11), 1119–1184.",
    "Zhong, X., Tang, J., & Yepes, A. J. (2019). PubLayNet: largest dataset ever for document layout analysis. Proc. ICDAR 2019, 1015–1022.",
    "Li, M., Xu, Y., Cui, L., et al. (2020). DocBank: A Benchmark Dataset for Document Layout Analysis. Proc. COLING 2020, 949–960.",
    "Hàn Thê Thành. (2000). Micro-typographic extensions to the TeX typesetting system. PhD thesis, Masaryk University.",
    "Kozierok, G. (2023). WeasyPrint Documentation v60. https://weasyprint.org/",
    "Apache Software Foundation. (2024). Apache FOP 2.9 User Documentation. https://xmlgraphics.apache.org/fop/",
    "iText Group. (2024). iText 8 Core: PDF Generation API. https://itextpdf.com/",
  ],
};
