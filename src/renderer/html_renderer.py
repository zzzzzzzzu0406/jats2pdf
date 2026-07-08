"""
HTML 渲染器：将 Article 结构数据 + Jinja2 模板 → HTML 文件

这是整个流水线的第二步：结构化数据 → HTML
"""

import os
from jinja2 import Environment, FileSystemLoader
from ..parser.jats_parser import Article

# 模板目录（相对于项目根目录）
_TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


class HTMLRenderer:
    """通过 Jinja2 模板将 Article 渲染为 HTML"""

    def __init__(self, template_dir: str = _TEMPLATE_DIR):
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=False,  # WeasyPrint 不需要HTML转义
            trim_blocks=True,
            lstrip_blocks=True,
        )
        # 注册自定义过滤器
        self.env.filters["orcid_url"] = lambda o: f"https://orcid.org/{o}" if o else "#"

    def render(self, article: Article, template_name: str = "article.html") -> str:
        """
        渲染文章为完整 HTML 字符串

        Args:
            article: 已解析的 Article 对象
            template_name: 模板文件名

        Returns:
            完整的 HTML 文档字符串
        """
        template = self.env.get_template(template_name)
        return template.render(
            article=article,
            # 额外上下文变量
            has_authors=bool(article.authors),
            has_keywords=bool(article.keywords),
            has_references=bool(article.references),
        )
