import { useState, useCallback, useRef, useEffect } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Upload,
  FileText,
  Columns2,
  Printer,
  ChevronRight,
  BookOpen,
  AlignLeft,
  X,
  Menu,
  Check,
  ArrowRight,

  Languages,
  FileSearch,
  LayoutTemplate,
  CreditCard,
  Cpu,
  Download,
  Plus,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

type Lang = "en" | "zh";
type Columns = 1 | 2;

interface Author {
  name: string;
  nameZh: string;
  affNum: number[];
  email?: string;
  orcid?: string;
}

interface Affiliation {
  num: number;
  text: string;
  textZh: string;
}

interface Section {
  id: string;
  num: string;
  title: string;
  titleZh: string;
  level: 1 | 2 | 3;
  content: ContentBlock[];
}

type ContentBlock =
  | { type: "para"; en: string; zh: string }
  | { type: "equation"; latex: string; label?: string; num?: number }
  | { type: "figure"; src: string; caption: string; captionZh: string; num: number; alt: string }
  | { type: "table"; caption: string; captionZh: string; num: number; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[]; itemsZh: string[] };

interface PaperData {
  doi: string;
  journal: string;
  journalZh: string;
  volume: string;
  issueDate: string;
  received: string;
  accepted: string;
  published: string;
  titleEn: string;
  titleZh: string;
  authors: Author[];
  affiliations: Affiliation[];
  abstractEn: string;
  abstractZh: string;
  keywordsEn: string[];
  keywordsZh: string[];
  sections: Section[];
  references: Reference[];
}

interface Reference {
  num: number;
  text: string;
}

// ─── sample paper data ────────────────────────────────────────────────────────

const PAPER: PaperData = {
  doi: "10.1016/j.eswa.2024.124891",
  journal: "Expert Systems with Applications",
  journalZh: "专家系统与应用",
  volume: "Vol. 249, Part A",
  issueDate: "1 September 2024",
  received: "14 November 2023",
  accepted: "29 March 2024",
  published: "2 April 2024",
  titleEn:
    "A Multilayer Integrative Framework for Automated Scientific Document Typesetting: From JATS XML Structured Data to High-Fidelity PDF Layout Generation",
  titleZh:
    "面向自动化科学文档排版的多层集成框架：从JATS XML结构化数据到高保真PDF版面生成",
  authors: [
    { name: "Wei Zhang", nameZh: "张伟", affNum: [1, 2], email: "w.zhang@nju.edu.cn", orcid: "0000-0001-7834-2910" },
    { name: "Lingyun Chen", nameZh: "陈凌云", affNum: [1], orcid: "0000-0002-4521-8803" },
    { name: "Rajan Kashyap", nameZh: "R. Kashyap", affNum: [3] },
    { name: "Mei-Ling Wang", nameZh: "王美玲", affNum: [1, 4] },
  ],
  affiliations: [
    { num: 1, text: "State Key Laboratory of Novel Software Technology, Nanjing University, Nanjing 210023, China", textZh: "新型软件技术国家重点实验室，南京大学，中国南京210023" },
    { num: 2, text: "Department of Computer Science and Engineering, Nanjing University, Nanjing 210023, China", textZh: "计算机科学与技术系，南京大学，中国南京210023" },
    { num: 3, text: "School of Information Systems, Singapore Management University, Singapore 188065", textZh: "信息系统学院，新加坡管理大学，新加坡188065" },
    { num: 4, text: "Collaborative Innovation Center of Novel Software Technology and Industrialization, Nanjing 210023, China", textZh: "软件新技术与产业化协同创新中心，中国南京210023" },
  ],
  abstractEn:
    "The automated typesetting of academic documents from structured data representations remains a significant challenge in scholarly publishing. This paper presents a novel multilayer integrative framework that maps Journal Article Tag Suite (JATS) XML structured data to high-fidelity print-ready PDF layouts, eliminating the need for manual typesetting expertise. Our approach decomposes the document rendering pipeline into four interdependent layers: semantic parsing, geometric allocation, flow resolution, and rasterisation. A constraint-satisfaction engine resolves cross-page breaks for floats—figures, tables, and multi-line equations—while a Unicode-aware mathematical typesetter delivers MathML formula rendering at typeset quality. Experiments on 1,240 articles from six Elsevier and Springer journals demonstrate that our system achieves layout fidelity scores of 94.3% compared to human-typeset gold standards, reduces production time by 78%, and supports flexible single-column and double-column mode switching with bilingual (Chinese–English) title and abstract output. The proposed framework establishes a reproducible baseline for fully automated scholarly publishing workflows.",
  abstractZh:
    "从结构化数据表示自动排版学术文档仍是学术出版中的重大挑战。本文提出了一种新颖的多层集成框架，将期刊文章标签套件（JATS）XML结构化数据映射为高保真可印刷PDF版面，无需人工排版专业知识。我们的方法将文档渲染管道分解为四个相互依赖的层次：语义解析、几何分配、流式排版和光栅化。约束求解引擎解决了浮动元素（图形、表格和多行公式）的跨页断行问题，而具有Unicode感知能力的数学排版器实现了MathML公式的高质量渲染。在来自Elsevier和Springer六种期刊的1,240篇文章上进行的实验表明，我们的系统与人工排版黄金标准相比，版面保真度达到94.3%，生产时间缩短78%，支持灵活的单栏和双栏模式切换，并提供中英文双语标题和摘要输出。所提框架为全自动学术出版工作流建立了可复现的基准。",
  keywordsEn: ["Document layout analysis", "JATS XML", "Automated typesetting", "PDF generation", "Mathematical rendering", "Multi-column layout"],
  keywordsZh: ["文档版面分析", "JATS XML", "自动化排版", "PDF生成", "数学公式渲染", "多栏排版"],
  sections: [
    {
      id: "s1",
      num: "1",
      title: "Introduction",
      titleZh: "1. 引言",
      level: 1,
      content: [
        {
          type: "para",
          en: "Academic publishing workflows have historically relied on skilled typesetters to transform author-submitted manuscripts into publication-ready layouts conforming to a journal's house style. With the proliferation of JATS XML as the de facto standard for structured article representation (NISO, 2021), there exists an unprecedented opportunity to automate this conversion pipeline end-to-end. However, achieving typeset-quality output that faithfully reproduces the visual and structural conventions of prestigious scientific journals remains an open problem.",
          zh: "学术出版工作流历来依赖熟练的排版人员将作者提交的手稿转换为符合期刊风格的可出版版面。随着JATS XML作为结构化文章表示事实标准的普及（NISO，2021年），出现了端到端自动化此转换流程的前所未有的机会。然而，实现高保真排版输出，忠实再现知名科学期刊的视觉和结构约定，仍然是一个开放性问题。",
        },
        {
          type: "para",
          en: "Existing commercial systems such as Inera eXtyles and Aries Author One address portions of the problem but remain closed-source and tightly coupled to proprietary XML schemas. Open-source alternatives—TeX/LaTeX, Pandoc, and XSLT-based transformers—require substantial configuration and expert knowledge to achieve publication-grade output. Neither category handles the full spectrum of typographic challenges encountered in modern multi-disciplinary journals, particularly cross-page float management and bidirectional mathematical formula layout.",
          zh: "现有商业系统如Inera eXtyles和Aries Author One解决了部分问题，但仍是闭源且与专有XML模式紧密耦合。开源替代方案——TeX/LaTeX、Pandoc和基于XSLT的转换器——需要大量配置和专业知识才能实现出版级输出。两类系统均无法处理现代多学科期刊中遇到的全谱排版挑战，特别是跨页浮动元素管理和双向数学公式布局。",
        },
        {
          type: "para",
          en: "We make the following contributions: (i) a four-layer rendering architecture that decouples semantic, geometric, flow, and rasterisation concerns; (ii) a constraint-based float scheduler that resolves cross-page placement while minimising whitespace waste; (iii) a high-performance MathML-to-SVG pipeline validated against the STIX Two reference font; and (iv) an open benchmark of 1,240 JATS articles with gold-standard human-typeset PDF counterparts.",
          zh: "本文作出如下贡献：(i) 一种四层渲染架构，将语义、几何、流式排版和光栅化关注点解耦；(ii) 一种基于约束的浮动元素调度器，在最小化空白浪费的同时解决跨页放置问题；(iii) 一种经STIX Two参考字体验证的高性能MathML转SVG管道；以及(iv) 一个包含1,240篇JATS文章及其人工排版PDF对照版本的开放基准。",
        },
      ],
    },
    {
      id: "s2",
      num: "2",
      title: "Background and Related Work",
      titleZh: "2. 背景与相关工作",
      level: 1,
      content: [
        {
          type: "para",
          en: "Document layout analysis has been studied extensively in the document image analysis community (Esposito et al., 2012; Mehri et al., 2017). Classical approaches decompose the problem into page segmentation, reading-order detection, and logical labelling. Deep learning methods (Shen et al., 2021; Zhong et al., 2019) have achieved state-of-the-art performance on public benchmarks such as PubLayNet and DocBank, but they operate on rasterised page images rather than structured source data.",
          zh: "文档版面分析在文档图像分析领域已被广泛研究（Esposito等，2012；Mehri等，2017）。经典方法将问题分解为页面分割、阅读顺序检测和逻辑标注。深度学习方法（Shen等，2021；Zhong等，2019）在PubLayNet和DocBank等公开基准上取得了最先进的性能，但它们在光栅化页面图像而非结构化源数据上运行。",
        },
        {
          type: "para",
          en: "Mathematical typesetting quality has been evaluated in several benchmark studies. Zanibbi and Blostein (2012) survey the state of mathematical recognition and rendering, concluding that font hinting and kerning remain the primary differentiators between TeX-quality and browser-quality output. Recent neural approaches (Deng et al., 2017; Wang et al., 2020) achieve character-level recognition accuracy exceeding 98% but do not address the compositional rendering of complex nested structures.",
          zh: "数学排版质量已在多项基准研究中被评估。Zanibbi和Blostein（2012）综述了数学公式识别与渲染的现状，得出字体提示和字距调整仍是TeX质量与浏览器质量输出之间主要差异因素的结论。最近的神经方法（Deng等，2017；Wang等，2020）实现了超过98%的字符级识别准确率，但没有解决复杂嵌套结构的组合渲染问题。",
        },
      ],
    },
    {
      id: "s3",
      num: "3",
      title: "System Architecture",
      titleZh: "3. 系统架构",
      level: 1,
      content: [
        {
          type: "para",
          en: "Our framework processes a JATS XML document through four sequentially dependent layers, each with a well-defined input/output contract. The overall pipeline is summarised in Fig. 1.",
          zh: "我们的框架通过四个顺序依赖的层次处理JATS XML文档，每层都有明确定义的输入/输出约定。整体管道如图1所示。",
        },
        {
          type: "figure",
          num: 1,
          src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop&auto=format",
          alt: "System architecture diagram showing four rendering layers",
          caption: "Fig. 1. Four-layer rendering architecture of the proposed framework. Arrows denote data flow between the Semantic Parser (SP), Geometric Allocator (GA), Flow Resolver (FR), and Rasterisation Engine (RE).",
          captionZh: "图1. 所提框架的四层渲染架构。箭头表示语义解析器（SP）、几何分配器（GA）、流式排版解析器（FR）和光栅化引擎（RE）之间的数据流。",
        },
      ],
    },
    {
      id: "s3-1",
      num: "3.1",
      title: "Semantic Parsing Layer",
      titleZh: "3.1 语义解析层",
      level: 2,
      content: [
        {
          type: "para",
          en: "The Semantic Parser (SP) ingests a validated JATS XML document and emits a normalised Document Object Model (DOM) enriched with rendering hints. Crucially, all cross-reference targets—figures, tables, equations, bibliography entries—are resolved to stable numeric identifiers at this stage, enabling downstream layers to compute layout without re-traversing the source.",
          zh: "语义解析器（SP）接收经过验证的JATS XML文档，并输出附有渲染提示的规范化文档对象模型（DOM）。关键是，所有交叉引用目标——图形、表格、公式、参考文献条目——在此阶段被解析为稳定的数字标识符，使下游层能够在不重新遍历源文档的情况下计算版面。",
        },
        {
          type: "para",
          en: "Mathematical content encoded as MathML is extracted and compiled to an intermediate representation (IR) using a port of the TeX math-mode algorithm. The mapping function M is defined as:",
          zh: "编码为MathML的数学内容被提取并使用TeX数学模式算法的移植版本编译为中间表示（IR）。映射函数M定义为：",
        },
        {
          type: "equation",
          latex: "M: \\mathcal{X}_{\\text{JATS}} \\rightarrow \\mathcal{D}_{\\text{IR}} \\quad \\text{where} \\quad \\mathcal{D}_{\\text{IR}} = (\\mathcal{N}, \\mathcal{E}, \\Phi)",
          label: "eq1",
          num: 1,
        },
        {
          type: "para",
          en: "Here 𝒩 denotes the set of layout nodes, ℰ the set of dependency edges, and Φ the set of rendering parameters. Each node n ∈ 𝒩 carries a bounding-box estimate B(n) computed from character-level advance widths and the active font metrics.",
          zh: "此处𝒩表示版面节点集合，ℰ表示依赖边集合，Φ表示渲染参数集合。每个节点n ∈ 𝒩携带由字符级推进宽度和当前字体度量计算的边界框估计B(n)。",
        },
      ],
    },
    {
      id: "s3-2",
      num: "3.2",
      title: "Geometric Allocation",
      titleZh: "3.2 几何分配",
      level: 2,
      content: [
        {
          type: "para",
          en: "The Geometric Allocator (GA) partitions the page canvas into a grid of typographic areas according to the target journal's specification sheet. A journal specification is encoded as a JSON descriptor containing column count, text block dimensions, margin widths, baseline grid pitch, and float-zone policies.",
          zh: "几何分配器（GA）根据目标期刊的规范表将页面画布划分为排版区域网格。期刊规范编码为包含栏数、文本块尺寸、边距宽度、基线网格间距和浮动区域策略的JSON描述符。",
        },
        {
          type: "para",
          en: "The allocation problem for floats is modelled as a constraint satisfaction problem (CSP). For each float f with height h(f) and width w(f), we seek an assignment (p, x, y) where p is the page number, x the horizontal offset, and y the vertical offset, such that:",
          zh: "浮动元素的分配问题被建模为约束满足问题（CSP）。对于具有高度h(f)和宽度w(f)的每个浮动元素f，我们寻求赋值(p, x, y)，其中p为页码，x为水平偏移，y为垂直偏移，使得：",
        },
        {
          type: "equation",
          latex: "\\forall f \\in \\mathcal{F}: \\quad p(f) \\geq p_{\\text{ref}}(f) \\quad \\land \\quad \\sum_{f' \\in \\mathcal{F}_p} A(f') \\leq (1-\\theta) \\cdot A_{\\text{page}}",
          label: "eq2",
          num: 2,
        },
        {
          type: "para",
          en: "The parameter θ ∈ [0, 0.5] bounds the maximum fractional area of a page that floats may occupy; we set θ = 0.45 in all experiments, matching the IEEE and Elsevier house styles. Table 1 compares layout metrics across baseline systems.",
          zh: "参数θ ∈ [0, 0.5]限制浮动元素可占用页面面积的最大比例；在所有实验中我们设θ = 0.45，与IEEE和Elsevier的风格指南一致。表1比较了各基线系统的版面指标。",
        },
        {
          type: "table",
          num: 1,
          caption: "Table 1. Layout fidelity comparison across typesetting systems. Scores are mean±std over 1,240 test articles. Bold denotes best performance.",
          captionZh: "表1. 各排版系统版面保真度比较。分数为1,240篇测试文章的均值±标准差。粗体表示最佳性能。",
          headers: ["System", "SSIM ↑", "CER ↓", "Float Acc. ↑", "Prod. Time ↓"],
          rows: [
            ["LaTeX (manual)", "0.978 ± 0.014", "0.003 ± 0.001", "97.2 ± 1.8%", "4.2 h"],
            ["Pandoc + HTML", "0.721 ± 0.042", "0.022 ± 0.005", "61.4 ± 6.1%", "12 min"],
            ["XSLT + FOP", "0.803 ± 0.031", "0.015 ± 0.003", "74.8 ± 4.3%", "8 min"],
            ["eXtyles (commercial)", "0.911 ± 0.022", "0.007 ± 0.002", "88.6 ± 3.2%", "45 min"],
            ["**Ours**", "**0.943 ± 0.018**", "**0.005 ± 0.001**", "**94.3 ± 2.1%**", "**55 sec**"],
          ],
        },
      ],
    },
    {
      id: "s4",
      num: "4",
      title: "Mathematical Rendering Pipeline",
      titleZh: "4. 数学公式渲染管道",
      level: 1,
      content: [
        {
          type: "para",
          en: "High-fidelity mathematical rendering is the most technically demanding component of the system. We adopt a two-phase approach: MathML normalisation followed by glyph-level layout. The typesetting quality objective is formalised as minimisation of the Wasserstein distance W₁ between the rendered glyph distribution G_r and the gold-standard TeX distribution G_t:",
          zh: "高保真数学公式渲染是系统中技术要求最高的组件。我们采用两阶段方法：MathML规范化，然后进行字形级排版。排版质量目标被形式化为最小化渲染字形分布G_r与黄金标准TeX分布G_t之间的Wasserstein距离W₁：",
        },
        {
          type: "equation",
          latex: "\\min_{\\Theta} \\; W_1(G_r(\\Theta),\\, G_t) = \\min_{\\Theta} \\int_0^1 \\left| F_{G_r}^{-1}(q) - F_{G_t}^{-1}(q) \\right| dq",
          label: "eq3",
          num: 3,
        },
        {
          type: "para",
          en: "where Θ denotes the set of font hinting and kerning parameters, and F⁻¹ is the quantile function of each distribution. This objective is optimised via a differentiable rasterisation proxy that back-propagates pixel-level loss to Θ. The pipeline processes an average of 3,200 display-mode equations per second on a single A100 GPU, sufficient for real-time interactive preview.",
          zh: "其中Θ表示字体提示和字距参数集合，F⁻¹为各分布的分位数函数。该目标通过可微分光栅化代理进行优化，将像素级损失反向传播到Θ。在单个A100 GPU上，该管道每秒处理平均3,200个显示模式公式，足以实现实时交互预览。",
        },
        {
          type: "figure",
          num: 2,
          src: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=380&fit=crop&auto=format",
          alt: "Mathematical formula rendering quality comparison",
          caption: "Fig. 2. Rendering quality comparison for a complex nested fraction. Left: browser-default MathML renderer. Centre: our pipeline with STIX Two font. Right: gold-standard pdfLaTeX output. SSIM scores: 0.71, 0.94, 1.00 respectively.",
          captionZh: "图2. 复杂嵌套分数的渲染质量比较。左：浏览器默认MathML渲染器。中：使用STIX Two字体的本文管道。右：黄金标准pdfLaTeX输出。SSIM分数分别为：0.71、0.94、1.00。",
        },
      ],
    },
    {
      id: "s5",
      num: "5",
      title: "Experiments and Results",
      titleZh: "5. 实验与结果",
      level: 1,
      content: [
        {
          type: "para",
          en: "We evaluated the framework on a benchmark corpus of 1,240 open-access articles sourced from six journals: Expert Systems with Applications, Pattern Recognition, Information Sciences, Neural Networks, Neurocomputing, and Knowledge-Based Systems. For each article, the JATS XML source and its publisher-typeset PDF were obtained via the Elsevier TDM API. Three expert assessors independently scored layout fidelity on a 5-point Likert scale; inter-rater reliability was κ = 0.81 (substantial agreement).",
          zh: "我们在一个包含1,240篇开放获取文章的基准语料库上评估了框架，这些文章来自六种期刊：Expert Systems with Applications、Pattern Recognition、Information Sciences、Neural Networks、Neurocomputing和Knowledge-Based Systems。通过Elsevier TDM API获取每篇文章的JATS XML源文件及其出版商排版PDF。三位专家评估者独立地在5点李克特量表上对版面保真度进行评分；评分者间可靠性为κ = 0.81（高度一致）。",
        },
        {
          type: "list",
          items: [
            "Single-column mode: 94.7% fidelity, 48 seconds mean production time.",
            "Double-column mode: 93.9% fidelity, 62 seconds mean production time.",
            "Mathematical articles (≥10 display equations): 91.2% fidelity.",
            "Articles with ≥5 floating elements: 92.8% fidelity.",
            "Bilingual (Chinese–English) output: 93.1% fidelity on title and abstract blocks.",
          ],
          itemsZh: [
            "单栏模式：保真度94.7%，平均生产时间48秒。",
            "双栏模式：保真度93.9%，平均生产时间62秒。",
            "数学类文章（≥10个显示公式）：保真度91.2%。",
            "含≥5个浮动元素的文章：保真度92.8%。",
            "中英双语输出（标题和摘要块）：保真度93.1%。",
          ],
        },
      ],
    },
    {
      id: "s6",
      num: "6",
      title: "Conclusion",
      titleZh: "6. 结论",
      level: 1,
      content: [
        {
          type: "para",
          en: "We have presented a comprehensive automated typesetting framework that bridges JATS XML structured data and publication-quality PDF output. The four-layer architecture cleanly separates concerns across semantic, geometric, flow, and rasterisation dimensions, enabling independent optimisation of each layer. Our constraint-based float scheduler and differentiable math renderer together account for the dominant sources of fidelity loss in prior systems. Future work will extend the framework to handle right-to-left scripts and variable-font phototypesetting.",
          zh: "本文提出了一个综合性的自动化排版框架，将JATS XML结构化数据与出版质量PDF输出相桥接。四层架构在语义、几何、流式排版和光栅化维度上清晰地分离了关注点，使每层能够独立优化。基于约束的浮动元素调度器和可微分数学渲染器共同解决了先前系统中保真度损失的主要来源。未来工作将扩展框架以处理从右到左书写的脚本和可变字体照相排版。",
        },
      ],
    },
  ],
  references: [
    { num: 1, text: "Deng, Y., Kanervisto, A., Ling, J., & Rush, A. M. (2017). Image-to-markup generation with coarse-to-fine attention. In Proceedings of the 34th ICML, 70, 980–989." },
    { num: 2, text: "Esposito, F., Ferilli, S., & Rotella, F. (2012). Machine learning for digital document processing: From layout analysis to metadata extraction. In Machine Learning, 165–186. Springer." },
    { num: 3, text: "Mehri, M., Lorn-Pierre, R., & Heroux, P. (2017). Segment-based document image classification. In Proceedings of ICDAR, 121–127." },
    { num: 4, text: "NISO. (2021). ANSI/NISO Z39.96-2019: JATS: Journal Article Tag Suite (Version 1.2). National Information Standards Organization." },
    { num: 5, text: "Shen, Z., Zhang, R., Dell, M., Lee, B. C. G., Carlson, J., & Li, W. (2021). LayoutParser: A unified toolkit for deep learning based document image analysis. In ICDAR 2021, 131–196." },
    { num: 6, text: "Wang, W., Xie, E., Li, X., Hou, W., Lu, T., Yu, G., & Shao, S. (2020). PANNet: Towards fast and accurate text detection. In AAAI 2020, 34(07), 11830–11837." },
    { num: 7, text: "Zanibbi, R., & Blostein, D. (2012). Recognition and retrieval of mathematical expressions. International Journal on Document Analysis and Recognition, 15(4), 331–357." },
    { num: 8, text: "Zhong, X., Tang, J., & Jimeno Yepes, A. (2019). PubLayNet: Largest dataset ever for document layout analysis. In ICDAR 2019, 1015–1022." },
  ],
};

// ─── KaTeX renderer ──────────────────────────────────────────────────────────

function KatexSpan({ latex, display = false }: { latex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          displayMode: display,
          throwOnError: false,
          trust: true,
          strict: false,
        });
      } catch {
        if (ref.current) ref.current.textContent = latex;
      }
    }
  }, [latex, display]);
  return <span ref={ref} />;
}

// ─── homepage data ────────────────────────────────────────────────────────────

type TemplateId = "ieee" | "elsevier" | "springer" | "nature";

interface JournalTemplate {
  id: TemplateId;
  name: string;
  publisher: string;
  price: number;
  badge?: string;
  features: { en: string[]; zh: string[] };
  desc: { en: string; zh: string };
}

const TEMPLATES: JournalTemplate[] = [
  {
    id: "ieee",
    name: "IEEE",
    publisher: "IEEE Xplore",
    price: 29,
    features: {
      en: ["IEEE two-column layout", "IEEE citation style (brackets)", "Formula & equation optimisation", "Transactions / Conference styles"],
      zh: ["IEEE 双栏版面布局", "IEEE 参考文献格式（方括号）", "公式与方程式优化排版", "期刊 / 会议双版式支持"],
    },
    desc: { en: "Standard IEEE publication layout for engineering journals and conference proceedings.", zh: "适用于工程期刊与会议论文集的标准 IEEE 出版版面。" },
  },
  {
    id: "elsevier",
    name: "Elsevier",
    publisher: "ScienceDirect",
    price: 35,
    badge: "Popular · 热门",
    features: {
      en: ["ScienceDirect single-column style", "Journal metadata & article info", "Highlights & graphical abstract", "Vancouver reference format"],
      zh: ["ScienceDirect 单栏风格", "期刊元数据与文章信息结构", "研究亮点与图文摘要", "Vancouver 参考文献格式"],
    },
    desc: { en: "Matches the visual language of Elsevier's flagship journals including Expert Systems with Applications.", zh: "匹配 Elsevier 旗舰期刊视觉语言，包括 Expert Systems with Applications。" },
  },
  {
    id: "springer",
    name: "Springer",
    publisher: "SpringerLink",
    price: 35,
    features: {
      en: ["Springer academic single-column", "Author–date (APA) reference style", "Chapter & section hierarchy", "LNCS conference variant"],
      zh: ["Springer 学术单栏版面", "作者-日期（APA）参考文献格式", "章节与小节层级结构", "LNCS 会议版式变体"],
    },
    desc: { en: "Professional Springer layout for journals and Lecture Notes in Computer Science series.", zh: "适用于 Springer 期刊与计算机科学丛书（LNCS）的专业版面。" },
  },
  {
    id: "nature",
    name: "Nature",
    publisher: "Nature Portfolio",
    price: 49,
    badge: "Premium · 高端",
    features: {
      en: ["Premium Nature typography", "High-fidelity figure rendering", "Nature citation superscript style", "Methods & extended data sections"],
      zh: ["高端 Nature 字体排印", "高保真图片渲染处理", "Nature 上标引用格式", "方法与扩展数据章节"],
    },
    desc: { en: "The exacting typographic standard of Nature and its sister journals. Highest fidelity output.", zh: "《自然》及其姊妹期刊严苛的字体排印标准，最高保真度输出。" },
  },
];

const TRANSLATION_PRICE = 49;

const STEPS = [
  { num: "01", icon: Upload,         en: "Upload Manuscript",       zh: "上传稿件" },
  { num: "02", icon: LayoutTemplate, en: "Choose Journal Template", zh: "选择期刊模板" },
  { num: "03", icon: Languages,      en: "Add Optional Translation", zh: "选配翻译服务" },
  { num: "04", icon: CreditCard,     en: "Complete Payment",         zh: "完成支付" },
  { num: "05", icon: Cpu,            en: "Generate Journal Paper",   zh: "生成期刊论文" },
  { num: "06", icon: Download,       en: "Export PDF",               zh: "导出 PDF" },
];

const NAV_LINKS = {
  en: ["Home", "Templates", "Features", "Pricing"],
  zh: ["首页", "模板库", "功能特性", "定价"],
};

// ─── lang toggle shared component ────────────────────────────────────────────

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex rounded-sm overflow-hidden border border-border shrink-0">
      {(["en", "zh"] as Lang[]).map((l, i) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={[
            "px-2.5 py-1 text-xs font-['Inter'] font-medium transition-colors",
            i > 0 ? "border-l border-border" : "",
            lang === l ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
          ].join(" ")}
        >
          {l === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}

// ─── homepage ─────────────────────────────────────────────────────────────────

function UploadScreen({ onLoad }: { onLoad: () => void }) {
  const [lang, setLang] = useState<Lang>("zh");
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [translationAdded, setTranslationAdded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setUploaded(true);
  }, []);

  const selectedTpl = TEMPLATES.find((t) => t.id === selectedTemplate);
  const templatePrice = selectedTpl?.price ?? 0;
  const totalPrice = templatePrice + (translationAdded ? TRANSLATION_PRICE : 0);

  const canProceed = uploaded && selectedTemplate !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col font-['Inter']">

      {/* ── sticky nav ── */}
      <header className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-5">
          {/* brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <BookOpen size={16} className="text-primary" strokeWidth={1.5} />
            <div className="leading-none">
              <span className="font-['EB_Garamond'] text-[15px] font-semibold text-primary tracking-tight">
                ScholarFormat
              </span>
            </div>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border" />
          <span className="hidden sm:block text-[9.5px] font-['Inter'] text-muted-foreground/70 tracking-[0.12em] uppercase">
            JATS XML Academic Publishing Infrastructure
          </span>

          {/* nav links desktop */}
          <nav className="hidden md:flex items-center gap-0 ml-auto">
            {NAV_LINKS[lang].map((link, i) => (
              <button
                key={i}
                className={[
                  "px-3 h-12 text-[11px] font-['Inter'] font-medium transition-colors border-b-2",
                  i === 0
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border",
                ].join(" ")}
              >
                {link}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:ml-4 ml-auto">
            <LangToggle lang={lang} setLang={setLang} />
            <div className="hidden sm:flex items-center gap-1">
              <button className="px-3 py-1.5 text-[11px] font-['Inter'] font-medium text-muted-foreground hover:text-foreground transition-colors">
                {lang === "zh" ? "登录" : "Login"}
              </button>
              <button className="px-3 py-1.5 text-[11px] font-['Inter'] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                {lang === "zh" ? "注册" : "Sign Up"}
              </button>
            </div>
            <button
              className="md:hidden p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
        {/* mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-3 flex flex-col gap-0">
            {NAV_LINKS[lang].map((link, i) => (
              <button key={i} className="text-left px-2 py-2 text-xs font-['Inter'] text-foreground/70 hover:text-foreground border-b border-border/40 last:border-0">
                {link}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── hero ── */}
      <section className="bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-8 pt-24 pb-20 flex flex-col items-center text-center">

          {/* eyebrow */}
          <p className="font-['Inter'] text-[10px] font-medium tracking-[0.28em] uppercase text-muted-foreground/45 mb-10 select-none">
            ScholarFormat &nbsp;·&nbsp;
            {lang === "zh" ? "国际学术出版平台" : "Academic Publishing Platform"}
          </p>

          {/* display title — Playfair for maximum editorial authority */}
          {lang === "zh" ? (
            <h1 className="font-['Playfair_Display'] text-[52px] md:text-[72px] font-normal text-foreground leading-[1.12] tracking-tight max-w-3xl mb-5">
              学术手稿智能排版
              <br />
              <span className="italic text-primary">与标准化生成平台</span>
            </h1>
          ) : (
            <h1 className="font-['Playfair_Display'] text-[44px] md:text-[60px] font-normal text-foreground leading-[1.15] tracking-tight max-w-3xl mb-5">
              Intelligent Academic
              <br />
              <span className="italic text-primary">Manuscript Publication System</span>
            </h1>
          )}

          {/* bilingual subtitle */}
          <p className="font-['EB_Garamond'] text-lg md:text-xl text-muted-foreground/50 italic mb-8 tracking-wide">
            {lang === "zh"
              ? "Intelligent Academic Manuscript Formatting and Publication System"
              : "学术手稿智能排版与标准化生成平台"}
          </p>

          {/* one-line description */}
          <p className="font-['Inter'] text-[13px] text-muted-foreground/70 max-w-md leading-relaxed mb-10">
            {lang === "zh"
              ? "自动将手稿转换为符合 IEEE、Elsevier、Springer、Nature 国际期刊的标准版面，支持中英双语输出。"
              : "Automated conversion of academic manuscripts to standardised layouts for major international journals. Full Chinese–English bilingual output."}
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground text-[13px] font-['Inter'] font-medium tracking-wide hover:bg-primary/90 transition-colors"
            >
              <Upload size={14} strokeWidth={1.5} />
              {lang === "zh" ? "上传稿件" : "Upload Manuscript"}
            </button>
            <button className="flex items-center gap-2 px-7 py-3 text-[13px] font-['Inter'] font-medium text-foreground/55 border border-border hover:border-primary/30 hover:text-primary transition-colors">
              <FileSearch size={14} strokeWidth={1.5} />
              {lang === "zh" ? "浏览出版模板" : "Browse Templates"}
            </button>
          </div>
        </div>
      </section>

      {/* ── main workflow: two-column layout ── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-10 flex gap-8 items-start">

        {/* left col: upload + templates + language */}
        <div className="flex-1 min-w-0 flex flex-col gap-8">

          {/* §1 upload */}
          <section>
            <SectionLabel num="01" lang={lang} en="Upload Manuscript" zh="上传稿件" />
            <p className="font-['EB_Garamond'] text-base text-muted-foreground/70 leading-relaxed mb-6 max-w-md italic">
              {lang === "zh"
                ? "提交您的学术论文，系统自动生成目标期刊标准版面。"
                : "Submit your manuscript. The system renders it to your chosen journal's publication standard."}
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={[
                "border border-dashed rounded cursor-pointer transition-all duration-200",
                "flex flex-col items-center justify-center py-12 px-8 gap-5",
                uploaded
                  ? "border-primary/40 bg-primary/[0.025]"
                  : dragging
                  ? "border-primary/50 bg-muted/40"
                  : "border-border hover:border-foreground/25 hover:bg-muted/20",
              ].join(" ")}
            >
              <input ref={fileRef} type="file" className="hidden" accept=".xml,.docx,.pdf,.txt" onChange={() => setUploaded(true)} />

              <div className={[
                "w-11 h-11 rounded-full flex items-center justify-center transition-colors",
                uploaded ? "bg-primary/10" : "bg-muted/80",
              ].join(" ")}>
                {uploaded
                  ? <Check size={17} className="text-primary" strokeWidth={1.5} />
                  : <Upload size={16} className="text-foreground/30" strokeWidth={1.5} />}
              </div>

              <div className="text-center space-y-1.5">
                <p className="font-['Playfair_Display'] text-[18px] font-normal text-foreground">
                  {uploaded
                    ? (lang === "zh" ? "稿件已上传" : "Manuscript uploaded")
                    : (lang === "zh" ? "拖放文件，或点击上传" : "Drag & drop, or click to upload")}
                </p>
                {uploaded ? (
                  <p className="font-['Inter'] text-[11.5px] text-primary/55 tracking-wide">
                    manuscript_draft.docx &ensp;·&ensp; 1.2 MB
                  </p>
                ) : (
                  <p className="font-['Inter'] text-[11.5px] text-muted-foreground/50 tracking-wide">
                    PDF &ensp;·&ensp; DOCX &ensp;·&ensp; XML &ensp;·&ensp; JATS XML
                    <br />
                    <span className="text-muted-foreground/35">
                      {lang === "zh" ? "最大 50 MB" : "Maximum 50 MB"}
                    </span>
                  </p>
                )}
              </div>

              {!uploaded && (
                <button className="px-6 py-2 text-[12.5px] font-['Inter'] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors tracking-wide">
                  {lang === "zh" ? "选择文件" : "Select file"}
                </button>
              )}
              {uploaded && (
                <button
                  className="font-['Inter'] text-[11.5px] text-muted-foreground/40 hover:text-muted-foreground transition-colors tracking-wide"
                  onClick={(e) => { e.stopPropagation(); setUploaded(false); }}
                >
                  {lang === "zh" ? "重新上传" : "Replace file"}
                </button>
              )}
            </div>
          </section>

          {/* §2 template selection */}
          <section>
            <SectionLabel num="02" lang={lang} en="Select Publication Standard" zh="选择期刊标准" />
            <p className="font-['EB_Garamond'] text-base text-muted-foreground/70 leading-relaxed mb-6 max-w-md italic">
              {lang === "zh"
                ? "每种模板完整还原对应期刊的版式体系、字体规范与引文格式。"
                : "Each template fully replicates the journal's layout system, typography, and citation standard."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => {
                const selected = selectedTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className={[
                      "border rounded transition-all duration-200 p-5 relative flex flex-col",
                      selected
                        ? "border-primary/50 bg-primary/[0.025] shadow-sm"
                        : "border-border bg-background hover:border-foreground/20 hover:shadow-sm",
                    ].join(" ")}
                  >
                    {/* journal identity */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-['Playfair_Display'] text-[26px] font-normal text-foreground leading-none tracking-tight">{tpl.name}</span>
                        {selected && (
                          <span className="flex items-center gap-1 text-[10px] font-['Inter'] font-medium text-primary border border-primary/25 px-2 py-0.5 rounded-full shrink-0 mt-1">
                            <Check size={9} strokeWidth={2.5} />
                            {lang === "zh" ? "已选" : "Selected"}
                          </span>
                        )}
                      </div>
                      <p className="font-['Inter'] text-[10.5px] text-muted-foreground/50 tracking-wide">{tpl.publisher}</p>
                    </div>

                    <p className="font-['EB_Garamond'] text-[14px] text-muted-foreground/65 mb-4 leading-relaxed italic">
                      {tpl.desc[lang]}
                    </p>

                    <ul className="space-y-1.5 mb-5 flex-1">
                      {tpl.features[lang].map((f, i) => (
                        <li key={i} className="flex items-start gap-2 font-['Inter'] text-[11.5px] text-foreground/55 leading-snug">
                          <span className="text-primary/25 shrink-0 mt-[3px]">◆</span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between pt-3.5 border-t border-border/40 mt-auto">
                      <button
                        onClick={() => setSelectedTemplate(selected ? null : tpl.id)}
                        className={[
                          "font-['Inter'] text-[12px] font-medium px-5 py-1.5 transition-colors tracking-wide",
                          selected
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border border-border text-foreground/60 hover:border-primary/40 hover:text-primary",
                        ].join(" ")}
                      >
                        {selected
                          ? (lang === "zh" ? "已选择" : "Selected")
                          : (lang === "zh" ? "选择" : "Select")}
                      </button>
                      <span className="font-['EB_Garamond'] text-[14px] text-muted-foreground/40">
                        ${tpl.price}
                        <span className="font-['Inter'] text-[9px] ml-0.5">{lang === "zh" ? "/篇" : "/art."}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* §3 language service */}
          <section>
            <SectionLabel num="03" lang={lang} en="Language Service" zh="语言服务" />
            <p className="font-['EB_Garamond'] text-base text-muted-foreground/70 leading-relaxed mb-6 max-w-md italic">
              {lang === "zh"
                ? "默认处理中文稿件。可选配学术翻译服务，同步生成符合英文期刊投稿规范的双语版本。"
                : "Chinese processing included by default. Optionally add academic translation for a parallel English submission version."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Chinese — default/included */}
              <div className="border border-border rounded bg-muted/10 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-['Playfair_Display'] text-[20px] font-normal text-foreground">
                      {lang === "zh" ? "中文稿件处理" : "Chinese Manuscript"}
                    </p>
                    <p className="font-['Inter'] text-[10.5px] text-muted-foreground/45 mt-0.5 tracking-wide">
                      {lang === "zh" ? "默认服务，已包含" : "Default · Included"}
                    </p>
                  </div>
                  <span className="font-['Inter'] text-[10px] font-medium text-foreground/40 border border-border rounded-full px-2 py-0.5 mt-0.5">
                    {lang === "zh" ? "已包含" : "Included"}
                  </span>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {[
                    lang === "zh" ? "中文字体排印与版式规范" : "Chinese typographic conventions",
                    lang === "zh" ? "GB/T 参考文献格式" : "GB/T reference formatting",
                    lang === "zh" ? "中文摘要与关键词" : "Chinese abstract & keywords",
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 font-['Inter'] text-[11.5px] text-foreground/55">
                      <span className="text-muted-foreground/30 shrink-0 mt-px">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-border/40">
                  <span className="font-['EB_Garamond'] text-[15px] text-muted-foreground/50">
                    {lang === "zh" ? "免费" : "Free"}
                  </span>
                </div>
              </div>

              {/* English translation — paid */}
              <div
                className={[
                  "border rounded transition-all duration-200 p-5 flex flex-col cursor-pointer",
                  translationAdded
                    ? "border-primary/40 bg-primary/[0.025] shadow-sm"
                    : "border-border bg-background hover:border-foreground/20 hover:shadow-sm",
                ].join(" ")}
                onClick={() => setTranslationAdded((v) => !v)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-['Playfair_Display'] text-[20px] font-normal text-foreground">
                      {lang === "zh" ? "中英学术翻译" : "CN → EN Translation"}
                    </p>
                    <p className="font-['Inter'] text-[10.5px] text-muted-foreground/45 mt-0.5 tracking-wide">
                      {lang === "zh" ? "可选增值服务" : "Optional add-on"}
                    </p>
                  </div>
                  {translationAdded ? (
                    <span className="flex items-center gap-1 font-['Inter'] text-[10px] font-medium text-primary border border-primary/30 rounded-full px-2 py-0.5 mt-0.5">
                      <Check size={9} strokeWidth={2.5} />
                      {lang === "zh" ? "已添加" : "Added"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-['Inter'] text-[10px] text-muted-foreground/40 border border-border rounded-full px-2 py-0.5 mt-0.5">
                      <Plus size={9} strokeWidth={2} />
                      {lang === "zh" ? "添加" : "Add"}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1">
                  {[
                    lang === "zh" ? "学术级英文翻译" : "Academic-grade English translation",
                    lang === "zh" ? "科技术语精准转换" : "Scientific terminology precision",
                    lang === "zh" ? "英文期刊投稿风格适配" : "English journal style adaptation",
                    lang === "zh" ? "同步生成中英双语版本" : "Parallel bilingual output",
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 font-['Inter'] text-[11.5px] text-foreground/60">
                      <span className="text-muted-foreground/30 shrink-0 mt-px">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="font-['EB_Garamond'] text-[15px] text-muted-foreground/60">
                    +${TRANSLATION_PRICE}
                    <span className="font-['Inter'] text-[10px] ml-0.5">{lang === "zh" ? "/篇" : "/article"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* output indicator */}
            <div className="mt-2 flex items-center gap-2.5 px-4 py-2.5 bg-muted/25 rounded border border-border/50">
              <span className="font-['Inter'] text-[11px] text-muted-foreground/50 shrink-0">
                {lang === "zh" ? "将生成：" : "Output:"}
              </span>
              <span className="font-['Inter'] text-[11.5px] text-foreground/60 border border-border/60 rounded px-2 py-0.5 bg-background">
                {lang === "zh" ? "中文版" : "Chinese version"}
              </span>
              {translationAdded && (
                <>
                  <Plus size={10} className="text-muted-foreground/30" />
                  <span className="font-['Inter'] text-[11.5px] text-primary/70 border border-primary/25 rounded px-2 py-0.5 bg-primary/[0.04]">
                    {lang === "zh" ? "英文版" : "English version"}
                  </span>
                </>
              )}
            </div>
          </section>

        </div>

        {/* right col: sticky publication configuration */}
        <aside className="shrink-0 hidden lg:block" style={{ width: "264px" }}>
          <div className="sticky top-16">
            <div className="border border-border rounded bg-card overflow-hidden">
              {/* panel header */}
              <div className="border-b border-border px-5 py-4 bg-background">
                <p className="font-['Playfair_Display'] text-[20px] font-normal text-foreground leading-tight">
                  {lang === "zh" ? "出版配置" : "Publication Configuration"}
                </p>
                <p className="font-['Inter'] text-[11px] text-muted-foreground/50 mt-0.5">
                  {lang === "zh" ? "当前出版参数概览" : "Current configuration summary"}
                </p>
              </div>

              <div className="px-5 py-5 space-y-4">
                {/* manuscript */}
                <div>
                  <p className="font-['Inter'] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
                    {lang === "zh" ? "稿件" : "Manuscript"}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={[
                      "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                      uploaded ? "bg-primary/70" : "bg-border",
                    ].join(" ")} />
                    <span className="font-['Inter'] text-[12px] text-foreground/65">
                      {uploaded ? "manuscript_draft.docx" : (lang === "zh" ? "尚未上传" : "Not uploaded")}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* journal template */}
                <div>
                  <p className="font-['Inter'] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
                    {lang === "zh" ? "期刊标准" : "Journal Standard"}
                  </p>
                  {selectedTpl ? (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-['EB_Garamond'] text-[15px] font-semibold text-foreground">{selectedTpl.name}</p>
                        <p className="font-['Inter'] text-[10.5px] text-muted-foreground/50">{selectedTpl.publisher}</p>
                      </div>
                      <span className="font-['EB_Garamond'] text-[14px] text-foreground/60 shrink-0">${selectedTpl.price}</span>
                    </div>
                  ) : (
                    <p className="font-['Inter'] text-[12px] text-muted-foreground/35 italic">
                      {lang === "zh" ? "尚未选择" : "Not selected"}
                    </p>
                  )}
                </div>

                <div className="h-px bg-border/50" />

                {/* language service */}
                <div>
                  <p className="font-['Inter'] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
                    {lang === "zh" ? "语言服务" : "Language Service"}
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-['Inter'] text-[12px] text-foreground/65">
                        {lang === "zh" ? "中文处理" : "Chinese processing"}
                      </span>
                      <span className="font-['Inter'] text-[10.5px] text-muted-foreground/40">
                        {lang === "zh" ? "已包含" : "Included"}
                      </span>
                    </div>
                    {translationAdded && (
                      <div className="flex items-center justify-between">
                        <span className="font-['Inter'] text-[12px] text-primary/70">
                          {lang === "zh" ? "+ 中英翻译" : "+ CN→EN"}
                        </span>
                        <span className="font-['EB_Garamond'] text-[14px] text-foreground/60">+${TRANSLATION_PRICE}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* estimated cost */}
                <div className="flex items-end justify-between">
                  <p className="font-['Inter'] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    {lang === "zh" ? "预计费用" : "Estimated Cost"}
                  </p>
                  <span className="font-['EB_Garamond'] text-3xl font-normal text-foreground leading-none">
                    ${totalPrice}
                  </span>
                </div>

                {/* cta */}
                <button
                  onClick={canProceed ? onLoad : undefined}
                  disabled={!canProceed}
                  className={[
                    "w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-['Inter'] font-medium rounded transition-all duration-200",
                    canProceed
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                      : "bg-muted/60 text-muted-foreground/50 cursor-not-allowed",
                  ].join(" ")}
                >
                  <CreditCard size={14} strokeWidth={1.5} />
                  {lang === "zh" ? "提交并付款" : "Proceed to Payment"}
                </button>

                {!canProceed && (
                  <p className="font-['Inter'] text-[10.5px] text-muted-foreground/40 text-center -mt-2">
                    {!uploaded && !selectedTemplate
                      ? (lang === "zh" ? "请上传稿件并选择模板" : "Upload manuscript & select template")
                      : !uploaded
                      ? (lang === "zh" ? "请先上传稿件" : "Please upload a manuscript")
                      : (lang === "zh" ? "请选择期刊模板" : "Please select a journal template")}
                  </p>
                )}

                {/* demo */}
                <button
                  onClick={onLoad}
                  className="w-full flex items-center justify-center gap-1.5 py-2 font-['Inter'] text-[11.5px] font-medium text-muted-foreground/50 border border-border/60 rounded hover:border-border hover:text-foreground/60 transition-colors"
                >
                  <FileText size={12} strokeWidth={1.5} />
                  {lang === "zh" ? "预览示例输出" : "Preview example output"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── supported publication standards ── */}
      <section className="border-t border-border bg-background">
        <div className="max-w-5xl mx-auto px-8 py-16">
          <div className="flex flex-col items-center mb-12">
            <p className="font-['Inter'] text-[10px] tracking-[0.26em] uppercase text-muted-foreground/40 mb-3">
              {lang === "zh" ? "支持的出版标准" : "Supported Publication Standards"}
            </p>
            <div className="w-8 h-px bg-border" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40">
            {[
              {
                name: "IEEE",
                identity: "IEEE Xplore",
                field: lang === "zh" ? "工程与计算机科学" : "Engineering & Computer Science",
                specs: lang === "zh"
                  ? ["双栏出版版面", "IEEE 引文格式", "公式优化排版"]
                  : ["Two-column layout", "IEEE citation style", "Formula optimisation"],
              },
              {
                name: "Elsevier",
                identity: "ScienceDirect",
                field: lang === "zh" ? "自然科学与工程" : "Natural Science & Engineering",
                specs: lang === "zh"
                  ? ["ScienceDirect 单栏风格", "Vancouver 引文格式", "研究亮点与图文摘要"]
                  : ["ScienceDirect single-column", "Vancouver citation format", "Highlights & graphical abstract"],
              },
              {
                name: "Springer",
                identity: "SpringerLink",
                field: lang === "zh" ? "跨学科学术研究" : "Interdisciplinary Research",
                specs: lang === "zh"
                  ? ["Springer 单栏学术版面", "APA 作者-日期格式", "LNCS 会议版式支持"]
                  : ["Springer academic layout", "APA author–date format", "LNCS conference variant"],
              },
              {
                name: "Nature",
                identity: "Nature Portfolio",
                field: lang === "zh" ? "顶级科学期刊" : "Premier Scientific Journals",
                specs: lang === "zh"
                  ? ["高端 Nature 字体排印", "上标引用格式", "Methods 与扩展数据章节"]
                  : ["Premium Nature typography", "Superscript citation style", "Methods & extended data"],
              },
            ].map((pub) => (
              <div key={pub.name} className="bg-background px-7 py-8 flex flex-col gap-3">
                <div>
                  <p className="font-['Playfair_Display'] text-[28px] font-normal text-foreground leading-none mb-1">
                    {pub.name}
                  </p>
                  <p className="font-['Inter'] text-[10.5px] text-muted-foreground/45 tracking-wide">{pub.identity}</p>
                </div>
                <p className="font-['EB_Garamond'] text-[13.5px] italic text-muted-foreground/60 leading-snug">
                  {pub.field}
                </p>
                <div className="pt-3 border-t border-border/40 space-y-1.5">
                  {pub.specs.map((s, i) => (
                    <p key={i} className="font-['Inter'] text-[11px] text-foreground/50 flex items-start gap-2">
                      <span className="text-primary/20 shrink-0 mt-[2px]">◆</span>
                      {s}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-border px-8 py-5 flex flex-wrap items-center justify-between gap-4 bg-background">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-primary/40" strokeWidth={1.5} />
          <span className="font-['EB_Garamond'] text-[14px] text-foreground/50 italic">ScholarFormat</span>
          <span className="text-muted-foreground/25 mx-1">·</span>
          <span className="font-['Inter'] text-[10px] text-muted-foreground/35">
            {lang === "zh" ? "学术出版平台" : "Academic Publishing Platform"}
          </span>
        </div>
        <p className="font-['Inter'] text-[10px] text-muted-foreground/30 text-center">
          © 2024 Nanjing University · JATS XML · ANSI/NISO Z39.96
        </p>
        <div className="flex gap-5">
          {(lang === "zh"
            ? ["隐私政策", "服务条款", "联系我们"]
            : ["Privacy", "Terms", "Contact"]
          ).map((l) => (
            <button key={l} className="font-['Inter'] text-[10px] text-muted-foreground/35 hover:text-muted-foreground transition-colors">
              {l}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ─── section label helper ─────────────────────────────────────────────────────

function SectionLabel({ num, en, zh, lang }: { num: string; en: string; zh: string; lang: Lang }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span className="font-['Inter'] text-[10px] text-muted-foreground/30 tabular-nums tracking-widest shrink-0 mt-1">
        {num}
      </span>
      <h2 className="font-['Playfair_Display'] text-2xl font-normal text-foreground leading-tight tracking-tight">
        {lang === "zh" ? zh : en}
      </h2>
    </div>
  );
}

// ─── content block renderers ──────────────────────────────────────────────────

function BlockRenderer({
  block,
  lang,
}: {
  block: ContentBlock;
  lang: Lang;
}) {
  if (block.type === "para") {
    return (
      <p className="font-['EB_Garamond'] text-[14px] leading-[1.72] text-foreground mb-3 text-justify hyphens-auto">
        {lang === "zh" ? block.zh : block.en}
      </p>
    );
  }

  if (block.type === "equation") {
    return (
      <div className="my-4 flex items-center justify-between">
        <div className="flex-1 flex justify-center">
          <KatexSpan latex={block.latex} display />
        </div>
        {block.num && (
          <span className="font-['Inter'] text-xs text-muted-foreground ml-4 shrink-0">
            ({block.num})
          </span>
        )}
      </div>
    );
  }

  if (block.type === "figure") {
    return (
      <figure className="my-5 break-inside-avoid">
        <div className="bg-muted/30 rounded-sm overflow-hidden">
          <img
            src={block.src}
            alt={block.alt}
            className="w-full object-cover max-h-52"
            loading="lazy"
          />
        </div>
        <figcaption className="mt-2 font-['Inter'] text-[11.5px] text-muted-foreground leading-snug text-justify">
          {lang === "zh" ? block.captionZh : block.caption}
        </figcaption>
      </figure>
    );
  }

  if (block.type === "table") {
    return (
      <figure className="my-5 break-inside-avoid">
        <figcaption className="font-['Inter'] text-[11.5px] text-muted-foreground mb-2 leading-snug">
          {lang === "zh" ? block.captionZh : block.caption}
        </figcaption>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] font-['Inter'] border-collapse">
            <thead>
              <tr className="border-t-2 border-b border-foreground/70">
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="py-1.5 pr-4 text-left font-semibold text-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri === block.rows.length - 1 ? "border-b-2 border-foreground/70" : "border-b border-border"}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={[
                        "py-1.5 pr-4 text-foreground/90 align-top",
                        cell.startsWith("**") ? "font-bold" : "",
                      ].join(" ")}
                    >
                      {cell.replace(/\*\*/g, "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    );
  }

  if (block.type === "list") {
    const items = lang === "zh" ? block.itemsZh : block.items;
    return (
      <ul className="my-3 pl-5 space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="font-['EB_Garamond'] text-[14px] leading-[1.65] text-foreground list-disc"
          >
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

// ─── paper viewer ─────────────────────────────────────────────────────────────

function PaperViewer({
  paper,
  onClose,
}: {
  paper: PaperData;
  onClose: () => void;
}) {
  const [columns, setColumns] = useState<Columns>(2);
  const [lang, setLang] = useState<Lang>("en");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("s1");
  const contentRef = useRef<HTMLDivElement>(null);

  const flatSections = paper.sections;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  };

  // track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      for (const s of flatSections) {
        const el = document.getElementById(s.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < 200) setActiveSection(s.id);
        }
      }
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, [flatSections]);

  return (
    <div className="h-screen bg-muted/20 flex flex-col overflow-hidden">
      {/* toolbar */}
      <header className="bg-background border-b border-border px-5 py-3 flex items-center gap-3 shrink-0 z-20">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <Menu size={16} />
        </button>

        <div className="flex items-center gap-2 mr-auto">
          <BookOpen size={16} className="text-primary" strokeWidth={1.5} />
          <span className="font-['EB_Garamond'] text-base font-semibold text-primary tracking-tight hidden sm:block">
            ScholarType
          </span>
          <ChevronRight size={13} className="text-muted-foreground hidden sm:block" />
          <span className="font-['Inter'] text-xs text-muted-foreground max-w-xs truncate hidden sm:block">
            {lang === "zh" ? paper.titleZh.slice(0, 40) + "…" : paper.titleEn.slice(0, 50) + "…"}
          </span>
        </div>

        {/* controls */}
        <div className="flex items-center gap-2">
          {/* column toggle */}
          <div className="flex rounded-sm overflow-hidden border border-border">
            <button
              title="Single column"
              onClick={() => setColumns(1)}
              className={[
                "px-2.5 py-1.5 transition-colors",
                columns === 1 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              <AlignLeft size={14} />
            </button>
            <button
              title="Double column"
              onClick={() => setColumns(2)}
              className={[
                "px-2.5 py-1.5 transition-colors border-l border-border",
                columns === 2 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              <Columns2 size={14} />
            </button>
          </div>

          {/* language toggle */}
          <div className="flex rounded-sm overflow-hidden border border-border">
            <button
              onClick={() => setLang("en")}
              className={[
                "px-2.5 py-1 text-xs font-['Inter'] font-medium transition-colors",
                lang === "en" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              EN
            </button>
            <button
              onClick={() => setLang("zh")}
              className={[
                "px-2.5 py-1 text-xs font-['Inter'] font-medium transition-colors border-l border-border",
                lang === "zh" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              中文
            </button>
          </div>

          <button
            onClick={() => window.print()}
            title="Print / Export PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Inter'] font-medium bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
          >
            <Printer size={13} />
            <span className="hidden sm:block">Export PDF</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* outline sidebar */}
        {sidebarOpen && (
          <aside className="w-56 bg-background border-r border-border flex flex-col shrink-0 overflow-y-auto py-4 hidden md:flex">
            <p className="px-4 text-[10px] font-['Inter'] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              Contents
            </p>
            <nav className="flex flex-col gap-0.5 px-2">
              {flatSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={[
                    "text-left px-2 py-1.5 rounded-sm text-xs font-['Inter'] leading-snug transition-colors",
                    s.level === 2 ? "pl-5" : "",
                    s.level === 3 ? "pl-8" : "",
                    activeSection === s.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  ].join(" ")}
                >
                  {lang === "zh" ? s.titleZh : `${s.num}. ${s.title}`}
                </button>
              ))}
              <button
                onClick={() => scrollTo("references")}
                className={[
                  "text-left px-2 py-1.5 rounded-sm text-xs font-['Inter'] leading-snug transition-colors",
                  activeSection === "references"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                ].join(" ")}
              >
                {lang === "zh" ? "参考文献" : "References"}
              </button>
            </nav>
          </aside>
        )}

        {/* paper canvas */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 py-8 bg-muted/20"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
        >
          <div
            className="mx-auto bg-background shadow-[0_1px_12px_rgba(0,0,0,0.10)] rounded-sm overflow-hidden print:shadow-none print:rounded-none"
            style={{ maxWidth: "820px" }}
          >
            {/* journal header band */}
            <div className="bg-primary px-8 py-3 flex items-center justify-between">
              <div>
                <p className="font-['EB_Garamond'] text-sm text-primary-foreground/90 italic">
                  {lang === "zh" ? paper.journalZh : paper.journal}
                </p>
                <p className="font-['Inter'] text-[10px] text-primary-foreground/60 mt-0.5">
                  {paper.volume} · {paper.issueDate} · DOI: {paper.doi}
                </p>
              </div>
              <div className="text-right">
                <span className="font-['Inter'] text-[10px] font-medium text-primary-foreground/50 tracking-wider uppercase">
                  Research Article
                </span>
              </div>
            </div>

            {/* article header — always single column */}
            <div className="px-9 pt-7 pb-5 border-b border-border">
              {/* bilingual title */}
              <h1 className="font-['EB_Garamond'] text-[22px] font-normal leading-[1.35] text-foreground mb-1">
                {paper.titleEn}
              </h1>
              {lang === "zh" && (
                <p className="font-['EB_Garamond'] text-base text-muted-foreground leading-snug mb-3 italic">
                  {paper.titleZh}
                </p>
              )}

              {/* authors */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                {paper.authors.map((a, i) => (
                  <span key={i} className="font-['Inter'] text-[12.5px] text-primary font-medium">
                    {lang === "zh" ? a.nameZh : a.name}
                    <sup className="text-[9px] text-accent ml-0.5">
                      {a.affNum.join(",")}
                    </sup>
                    {a.email && (
                      <span className="text-[9px] text-accent ml-0.5">*</span>
                    )}
                  </span>
                ))}
              </div>

              {/* affiliations */}
              <div className="mt-3 space-y-0.5">
                {paper.affiliations.map((af) => (
                  <p key={af.num} className="font-['Inter'] text-[11px] text-muted-foreground leading-snug">
                    <sup className="text-accent mr-0.5 font-semibold">{af.num}</sup>
                    {lang === "zh" ? af.textZh : af.text}
                  </p>
                ))}
              </div>

              {/* dates */}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {[
                  { label: "Received", labelZh: "收稿", date: paper.received },
                  { label: "Accepted", labelZh: "录用", date: paper.accepted },
                  { label: "Published", labelZh: "发表", date: paper.published },
                ].map((d) => (
                  <span key={d.label} className="font-['Inter'] text-[10.5px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      {lang === "zh" ? d.labelZh : d.label}:
                    </span>{" "}
                    {d.date}
                  </span>
                ))}
              </div>
            </div>

            {/* abstract + keywords — always single col */}
            <div className="px-9 py-5 border-b border-border bg-muted/20">
              <div className="flex gap-1.5 items-baseline mb-2">
                <h2 className="font-['EB_Garamond'] text-base font-semibold text-foreground">
                  {lang === "zh" ? "摘要" : "Abstract"}
                </h2>
              </div>
              <p className="font-['EB_Garamond'] text-[13.5px] leading-[1.72] text-foreground text-justify hyphens-auto">
                {lang === "zh" ? paper.abstractZh : paper.abstractEn}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 items-start">
                <span className="font-['Inter'] text-[11px] font-semibold text-foreground/80 mt-0.5 shrink-0">
                  {lang === "zh" ? "关键词：" : "Keywords:"}
                </span>
                {(lang === "zh" ? paper.keywordsZh : paper.keywordsEn).map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[10.5px] font-['Inter'] text-primary border border-primary/25 rounded-sm bg-primary/5"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* article body */}
            <div
              className={[
                "px-9 py-6",
                columns === 2 ? "columns-2 gap-6" : "",
              ].join(" ")}
              style={columns === 2 ? { columnRule: "1px solid rgba(0,0,0,0.08)" } : {}}
            >
              {paper.sections.map((section) => (
                <div
                  key={section.id}
                  id={section.id}
                  className={[
                    "break-inside-avoid-column",
                    section.level === 1 ? "mt-5" : "mt-3",
                  ].join(" ")}
                >
                  <SectionHeading section={section} lang={lang} />
                  {section.content.map((block, bi) => (
                    <BlockRenderer key={bi} block={block} lang={lang} />
                  ))}
                </div>
              ))}

              {/* references */}
              <div id="references" className="mt-6 break-inside-avoid-column">
                <h2 className="font-['EB_Garamond'] text-base font-semibold text-foreground border-t border-foreground/20 pt-4 mb-3">
                  {lang === "zh" ? "参考文献" : "References"}
                </h2>
                <ol className="space-y-2">
                  {paper.references.map((ref) => (
                    <li key={ref.num} className="flex gap-2">
                      <span className="font-['Inter'] text-[11px] text-muted-foreground shrink-0 mt-0.5 w-5 text-right">
                        [{ref.num}]
                      </span>
                      <span className="font-['EB_Garamond'] text-[12.5px] leading-snug text-foreground/85">
                        {ref.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* page footer */}
            <div className="border-t border-border px-9 py-3 flex items-center justify-between bg-muted/10">
              <span className="font-['Inter'] text-[10px] text-muted-foreground">
                {paper.journal}
              </span>
              <span className="font-['Inter'] text-[10px] text-muted-foreground">
                {paper.doi}
              </span>
              <span className="font-['Inter'] text-[10px] text-muted-foreground">
                p. 1
              </span>
            </div>
          </div>

          {/* print styles injected inline */}
          <style>{`
            @media print {
              header, aside, .print\\:hidden { display: none !important; }
              body { background: white; }
              .shadow-\\[0_1px_12px_rgba\\(0\\,0\\,0\\,0\\.10\\)\\] { box-shadow: none; }
            }
            .columns-2 { column-count: 2; }
            @media (max-width: 600px) { .columns-2 { column-count: 1; } }
          `}</style>
        </main>
      </div>
    </div>
  );
}

// ─── section heading ──────────────────────────────────────────────────────────

function SectionHeading({ section, lang }: { section: Section; lang: Lang }) {
  const label = lang === "zh" ? section.titleZh : `${section.num}. ${section.title}`;

  if (section.level === 1) {
    return (
      <h2 className="font-['EB_Garamond'] text-[15.5px] font-semibold text-primary mb-2 mt-1 border-b border-border/50 pb-1">
        {label}
      </h2>
    );
  }
  if (section.level === 2) {
    return (
      <h3 className="font-['EB_Garamond'] text-[14px] font-semibold text-foreground mb-1.5 italic">
        {label}
      </h3>
    );
  }
  return (
    <h4 className="font-['Inter'] text-[12.5px] font-semibold text-foreground mb-1 uppercase tracking-wide">
      {label}
    </h4>
  );
}

// ─── root app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<"upload" | "viewer">("upload");

  return view === "upload" ? (
    <UploadScreen onLoad={() => setView("viewer")} />
  ) : (
    <PaperViewer paper={PAPER} onClose={() => setView("upload")} />
  );
}
