# ScholarType 文章编辑工作台

React + Vite 工作台，从 `/api/articles/{id}/editor` 加载真实 JATS 数据，并保留基础信息、摘要、章节、图表和参考文献编辑、中英预览、单双栏、PDF 打印与 Word 导出功能。

正常运行请从仓库根目录构建前端并启动统一服务：

```bash
npm run web:install
npm run web:build
.venv/bin/python -m src.server
```

门户、工作台和 API 共用 `http://127.0.0.1:8000/`，工作台路径为 `/studio/`。

`npm run studio:dev` 仅用于需要热更新的前端调试，不属于正常启动方式。

当前编辑状态仅保存在浏览器内存中，尚无后端持久化接口。
