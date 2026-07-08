# JATS2PDF - 学术期刊智能排版引擎

> 🏆 期刊大赛 · 选题2：基于 JATS XML 结构数据的 PDF 自动排版与生成

## 项目简介

将学术期刊的 JATS XML 标准数据自动渲染为排版精美的 PDF 论文。

**核心流程：JATS XML → 结构化解析 → Jinja2模板渲染 → WeasyPrint生成PDF**

## 环境要求

- Python 3.10+
- 系统中文字体（推荐 [Noto Serif CJK SC](https://github.com/googlefonts/noto-cjk)）

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行示例（解析示例XML → 生成PDF）
python -m src.main samples/sample1.xml -o samples/output/sample1.pdf

# 3. 只看中间HTML（调试用）
python -m src.main samples/sample1.xml --html --html-output debug.html
```

## 项目结构

```
.
├── src/
│   ├── parser/
│   │   └── jats_parser.py      # JATS XML 解析器
│   ├── renderer/
│   │   ├── html_renderer.py    # Jinja2 → HTML
│   │   └── pdf_renderer.py     # WeasyPrint → PDF
│   ├── templates/
│   │   ├── article.html        # HTML 模板
│   │   └── styles.css          # 排版样式
│   └── main.py                 # 命令行入口
├── samples/
│   ├── sample1.xml             # 示例 JATS XML
│   └── output/                 # 生成的 PDF
├── tests/                      # 单元测试
├── docs/                       # 文档
└── requirements.txt
```

## 运行测试

```bash
pytest tests/ -v
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| XML解析 | lxml | XPath查询，高性能XML处理 |
| 模板引擎 | Jinja2 | HTML模板渲染 |
| PDF生成 | WeasyPrint | HTML+CSS → PDF |
| 公式渲染 | MathJax | MathML/SVG矢量化 |
| 测试 | pytest | 单元测试框架 |

## 团队

- [@zzzzzzzu0406](https://github.com/zzzzzzzu0406)
- [@cyc120](https://github.com/cyc120)
