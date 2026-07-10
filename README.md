# JATS2PDF - 学术期刊智能排版引擎

> 🏆 期刊大赛 · 选题2：基于 JATS XML 结构数据的 PDF 自动排版与生成

## 项目简介

将学术期刊的 JATS XML 标准数据自动渲染为排版精美的 PDF 论文。

**核心流程：JATS XML → 结构化解析 → Jinja2 模板渲染 → WeasyPrint 生成 PDF**

## 赛题要求覆盖（选题2）

| # | 要求 | 实现 |
|---|------|------|
| 1 | 标题/作者/摘要/关键词渲染 | 解析 + 模板渲染；**中英双语**（abstract_en/keywords_en）；**机构上标+列表** |
| 2 | 正文+章节流式排版 | 多级章节嵌套；首行缩进2em、行距1.6、标题层级 pt 字号（@media print） |
| 3 | 图表自动编号+交叉引用 | 解析层按文档顺序自动编号（图1/表1）；正文 `<xref>` 渲染为可点击链接 |
| 4 | MathML 高保真渲染 | **mathjax-node 预渲染 MathML→SVG**（块级+行内），WeasyPrint 矢量渲染 |
| 5 | 参考文献格式化 | Elsevier / **GB-T 7714** 两种格式（`--ref-style`），悬挂缩进2em |
| 6 | 单/双栏切换 | `--two-column`；摘要/图表/公式/参考文献跨栏（column-span:all） |
| 7 | 页眉页脚/页码 | `@page` 期刊名 running header + `counter(page)`，首页无页眉 |

## 环境要求

- **Python 3.10+**（开发用 3.14 `.venv`；WeasyPrint 原生用 conda env 3.12，见下）
- **Node.js**（公式 MathML→SVG 预渲染用，mathjax-node）
- 系统中文字体（推荐 Noto Serif/Sans CJK SC；macOS 自带 STHeiti 亦可）

### PDF 引擎（自动二选一）

`src/renderer/pdf_renderer.py` 自动选择：

1. **WeasyPrint（首选，原生 CSS Paged Media）** — 支持 `@page` 页眉页码、`column-count` 双栏、`page-break`。
   WeasyPrint 需系统 GTK 库（pango/cairo）。**macOS 上若无法装 Homebrew**（如网络受限），
   可用 conda-forge 自带 GTK 的 weasyprint，**无需 brew、无需 sudo**：
   ```bash
   # 装 miniconda（用户目录，无 sudo）后：
   conda create -y -n jats2pdf --override-channels -c conda-forge python=3.12 weasyprint pango lxml jinja2 pytest
   conda activate jats2pdf
   ```
2. **Chrome headless（回退）** — WeasyPrint 不可用时自动用系统 Chrome/Edge 打印 PDF。
   零额外安装，但不支持 `@page` 页眉（页码仍可，期刊名 running header 丢失）。

### 公式预渲染（mathjax-node）

WeasyPrint 不执行 JS、不渲染 MathML，故公式需预渲染为 SVG。依赖 mathjax-node：
```bash
# ⚠ mathjax-node 对含非 ASCII 的安装路径有 bug，须装在无中文路径下：
mkdir -p ~/mjnode && cd ~/mjnode && npm install mathjax-node
# 辅助脚本 mathml2svg.js 由 formula_renderer.py 自举生成
```
未安装时自动降级为原样 MathML（PDF 中公式会退化为文本，建议安装）。

## 快速开始

```bash
# 用 conda env（WeasyPrint 原生）跑示例：
conda activate jats2pdf
python -m src.main samples/sample1.xml -o samples/output/sample1.pdf

# 双栏 + GB/T 7714 参考文献：
python -m src.main samples/sample1.xml --two-column --ref-style gbt7714 -o out.pdf

# 只看中间 HTML（调试）：
python -m src.main samples/sample1.xml --html --html-output debug.html

# 生成多页面平台静态站点（首页/浏览/详情/上传/关于）：
python build_site.py
```

### CLI 参数

| 参数 | 说明 |
|------|------|
| `input` | 输入 JATS XML 路径 |
| `-o/--output` | 输出 PDF 路径 |
| `--html` / `--html-output` | 只生成中间 HTML（调试） |
| `--two-column` | 启用双栏排版 |
| `--ref-style {elsevier,gbt7714}` | 参考文献格式（默认 elsevier） |
| `--no-render-formulas` | 关闭公式 MathML→SVG 预渲染（默认开启） |
| `--css` | 自定义 CSS 样式表 |

## 项目结构

```
.
├── src/
│   ├── parser/jats_parser.py        # JATS XML 解析 + 数据模型(含 xref/编号/双语/机构)
│   ├── renderer/
│   │   ├── html_renderer.py         # Jinja2 → HTML（多页面）
│   │   ├── pdf_renderer.py          # WeasyPrint → PDF（自动回退 Chrome headless）
│   │   └── formula_renderer.py      # MathML/LaTeX → SVG（mathjax-node）
│   ├── templates/
│   │   ├── article.html             # 论文详情模板（xref/扁平化跨栏/双语/机构/Elsevier·GB-T7714）
│   │   ├── base.html / *.html       # 平台页面模板
│   │   └── styles.css               # 打印排版样式（@page/@media print/.two-column）
│   └── main.py                      # CLI 入口
├── assets/css/platform.css, assets/js/platform.js   # web 平台样式/脚本
├── samples/sample1.xml              # 示例 JATS（含双语/机构/fig/xref/inline-formula）
├── build_site.py                    # 静态站点构建
├── tests/                           # 单元测试（15 项）
├── docs/                            # 设计规范、项目说明
└── requirements.txt
```

## 运行测试

```bash
pytest tests/ -v     # 15 项，含公式 SVG 集成测试
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| XML 解析 | lxml | XPath 查询，高性能 XML 处理 |
| 模板引擎 | Jinja2 | HTML 模板渲染（含宏：自动编号/交叉引用/参考文献格式） |
| PDF 生成 | WeasyPrint | HTML+CSS Paged Media → PDF（回退 Chrome headless） |
| 公式渲染 | mathjax-node | MathML/LaTeX → SVG 矢量预渲染 |
| 测试 | pytest | 单元 + 集成测试 |

## 已知限制

- **WeasyPrint `column-span:all` 仅对 multicol 容器直接子元素生效**：故模板把图/表/公式
  从 `<section>` 内「扁平化」提升为 `.layout-main` 直接子元素，双栏下才能正确跨栏。
- WeasyPrint 不渲染 MathML（须 mathjax-node 预渲染 SVG）；不支持 `box-shadow`/CSS 变量部分场景（仅影响 web 外观，不影响 PDF 排版）。

## 团队

- [@zzzzzzzu0406](https://github.com/zzzzzzzu0406)
- [@cyc120](https://github.com/cyc120)
