# ScholarType 门户

React + Vite + Tailwind 应用，负责 JATS XML/ZIP 上传、文章库搜索、排版预览以及后端 HTML/PDF 下载。

正常运行请从仓库根目录构建前端并启动统一服务：

```bash
npm run web:install
npm run web:build
.venv/bin/python -m src.server
```

门户、编辑工作台和 API 共用 `http://127.0.0.1:8000/`。

`npm run portal:dev` 仅用于需要热更新的前端调试，不属于正常启动方式。
