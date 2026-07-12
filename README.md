# ScholarType / JATS2PDF

将 JATS XML 论文解析为结构化数据，并在同一个 Web 服务中完成上传、文章库浏览、内容编辑、单双栏预览、HTML/PDF/Word 导出。

生产模式下，React 门户、文章编辑工作台和 FastAPI API 共用一个端口：`http://127.0.0.1:8000/`。

## 主要功能

- 上传单个 `.xml`，或上传包含一个 JATS XML 与配图的 `.zip` 资源包。
- 使用 SQLite 保存文章索引，支持搜索、分页和筛选。
- 解析标题、作者、机构、双语摘要、关键词、章节、图表、公式、交叉引用和参考文献。
- 门户预览与后端 PDF 使用同一份 `article_preview.html`，减少预览和导出的样式差异。
- 支持单栏/双栏、Elsevier/GB-T 7714、字体风格和字号切换。
- 双栏样式参考《计算机学报》：标题/作者/摘要通栏，正文双栏，图表默认栏内排版。
- PDF 导出前自动嵌入、旋转校正和压缩图片，避免远程图片缺失或超大图片拖慢渲染。
- 完整文章工作台支持编辑基础信息、摘要、关键词、章节、图表和参考文献，并可切换中英预览、单双栏、PDF 打印和 Word 导出。

> 当前工作台编辑内容保存在浏览器内存中，尚未提供 PUT/PATCH 接口持久化修改。门户的后端 PDF 与工作台的浏览器打印是两条独立导出链路。

## 系统架构

```text
JATS XML / ZIP
      │
      ▼
lxml JATSParser ──► Article 数据模型 ──► SQLite / pickle 文章库
      │                                      │
      ├──► Jinja2 预览模板 ──► WeasyPrint ──► PDF
      │                         └─ Chrome headless 回退
      │
      └──► FastAPI JSON API ──► React 门户 / React 编辑工作台
```

## 环境要求

- Python 3.10+
- Node.js 20+、npm 10+
- WeasyPrint 所需的 Pango/Cairo 等系统库
- 推荐安装 Noto Serif/Sans CJK 中文字体

WeasyPrint 无法加载时，`PDFRenderer` 会尝试使用 Chrome、Edge、Brave 或 Chromium 的 headless 模式生成 PDF。

## 安装与运行

```bash
# Python
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

# 前端
npm run web:install
npm run web:build

# 启动统一服务
python -m src.server
```

打开：

- 门户与文章库：http://127.0.0.1:8000/
- 文章编辑工作台：http://127.0.0.1:8000/studio/
- 健康检查：http://127.0.0.1:8000/api/health

### 单端口运行说明

项目的默认运行方式只有一个端口：

```bash
npm run web:build
.venv/bin/python -m src.server
```

门户、文章库、编辑工作台和全部 API 均由 `http://127.0.0.1:8000/` 提供；页面之间通过顶部导航切换，不需要分别启动两个前端服务。

`npm run portal:dev` 和 `npm run studio:dev` 仅用于前端开发人员临时启用 Vite 热更新，会占用 `5173/5174`，不属于项目的正常启动或交付方式。

## 公式渲染

WeasyPrint 不执行 JavaScript，也不会直接高保真渲染 MathML。项目可通过 `mathjax-node` 将 MathML/LaTeX 预渲染为 SVG：

```bash
mkdir -p ~/mjnode
npm install --prefix ~/mjnode mathjax-node@2.1.1
```

也可以用 `JATS2PDF_MJDIR` 指定安装目录。未安装时，公式会回退为原始 MathML/文本。

## 命令行使用

```bash
# 默认 PDF
.venv/bin/python -m src.main samples/sample1.xml -o output.pdf

# 双栏 + GB/T 7714
.venv/bin/python -m src.main samples/sample1.xml \
  --two-column \
  --ref-style gbt7714 \
  -o output.pdf

# 仅生成中间 HTML
.venv/bin/python -m src.main samples/sample1.xml \
  --html \
  --html-output debug.html

# 不执行公式预渲染
.venv/bin/python -m src.main samples/sample1.xml \
  --no-render-formulas \
  -o output.pdf
```

## 常用 API

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/upload` | 上传 JATS XML 或 XML+图片 ZIP |
| `GET` | `/api/articles` | 文章列表、搜索、分页和筛选 |
| `GET` | `/api/articles/{id}/editor` | 编辑器结构化数据 |
| `GET` | `/api/articles/{id}/preview` | 自包含 HTML 预览 |
| `GET` | `/api/articles/{id}/html` | 下载 HTML |
| `GET` | `/api/articles/{id}/pdf` | 生成并下载后端 PDF |
| `GET` | `/api/filters` | 可用筛选项 |
| `GET` | `/api/health` | 服务状态 |

## 项目结构

```text
.
├── src/
│   ├── parser/jats_parser.py       # JATS 解析与数据模型
│   ├── renderer/                   # HTML、PDF、公式渲染
│   ├── templates/                  # CLI、预览与回退页面模板
│   ├── server.py                   # FastAPI 页面与 API
│   └── store.py                    # SQLite / pickle 文章存储
├── web/
│   ├── upload/                     # React 上传门户与文章库
│   └── article/                    # React 文章编辑工作台
├── assets/                         # Jinja 回退页面静态资源
├── samples/                        # 示例与真实 JATS XML
├── tests/                          # Python 单元与集成测试
├── build_site.py                   # 可选的旧版静态站构建器
├── requirements.txt               # Python 运行依赖
├── requirements-dev.txt           # 测试与格式化工具
└── 技术栈.md                       # 架构和技术选型详情
```

`data/` 保存真实文章库和上传图片，属于运行数据，不应作为缓存删除。`dist/`、`samples/output/`、`tmp/`、`output/` 等生成目录已加入 `.gitignore`。

## 测试与验证

```bash
python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q
npm run web:build
```

当前共 38 项测试，覆盖 JATS 解析、模板渲染、公式处理、文章存储、上传限制、ZIP 图片、PMC 图片回退、PDF 图片嵌入，以及预览/PDF 共用文档等关键路径。

## 技术栈

详见 [技术栈.md](./技术栈.md)。

## 团队

- [@zzzzzzzu0406](https://github.com/zzzzzzzu0406)
- [@cyc120](https://github.com/cyc120)
