"""
文章存储层 —— SQLite 元数据 + pickle 持久化 Article 对象
========================================================
提供文章的增删查改、分页搜索、筛选值提取。
启动时自动扫描 samples/ 目录种子数据。
"""

import os
import pickle
import sqlite3
import uuid
import re
from datetime import datetime
from typing import Optional

SAMPLES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples")
SAMPLE_FILES = [
    os.path.join(SAMPLES_DIR, "sample1.xml"),
] + sorted(
    f for f in [
        os.path.join(SAMPLES_DIR, "real", x)
        for x in os.listdir(os.path.join(SAMPLES_DIR, "real"))
    ]
    if f.endswith(".xml")
)


class ArticleStore:
    """文章存储：SQLite 存元数据，pickle 存完整 Article 对象"""

    def __init__(self, db_path: str = "data/articles.db", data_dir: str = "data/articles/"):
        self.db_path = db_path
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

    # ── 数据库连接 ──────────────────────────────

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    # ── 初始化 ──────────────────────────────────

    def init_db(self):
        """建表"""
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS articles (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    title_en TEXT DEFAULT '',
                    authors_json TEXT DEFAULT '[]',
                    keywords_json TEXT DEFAULT '[]',
                    keywords_en_json TEXT DEFAULT '[]',
                    abstract TEXT DEFAULT '',
                    abstract_en TEXT DEFAULT '',
                    journal TEXT DEFAULT '',
                    doi TEXT DEFAULT '',
                    year INTEGER,
                    lang TEXT DEFAULT 'zh',
                    ref_count INTEGER DEFAULT 0,
                    section_count INTEGER DEFAULT 0,
                    figure_count INTEGER DEFAULT 0,
                    table_count INTEGER DEFAULT 0,
                    formula_count INTEGER DEFAULT 0,
                    source TEXT DEFAULT 'upload',
                    original_filename TEXT DEFAULT '',
                    file_size INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            """)
            conn.commit()

    def initialize(self):
        """首次启动：扫描 samples/ 种子数据"""
        self.init_db()
        with self._conn() as conn:
            count = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
        if count > 0:
            return  # 已有数据，跳过种子

        from .parser.jats_parser import JATSParser

        for filepath in SAMPLE_FILES:
            if not os.path.exists(filepath):
                continue
            try:
                article = JATSParser(filepath).parse()
                filename = os.path.basename(filepath)
                source = "sample" if "real" not in filepath else "sample_real"
                self.add_article(article, filename, source, filepath)
            except Exception as e:
                print(f"  [store] 种子数据解析失败 {filepath}: {e}")

    # ── CRUD ────────────────────────────────────

    def add_article(self, article, filename: str = "", source: str = "upload",
                    filepath: str = "") -> str:
        """存储 Article，返回 article_id。若 filepath 非空则读取文件大小。"""
        article_id = str(uuid.uuid4())[:8]
        file_size = 0
        if filepath and os.path.exists(filepath):
            file_size = os.path.getsize(filepath)

        # 提取年份
        year = self._extract_year(article)

        # 统计公式（递归遍历 sections）
        formula_count = self._count_formulas(article.sections)

        authors_json = [
            {"given_name": a.given_name, "surname": a.surname,
             "affiliation": a.affiliation, "orcid": a.orcid}
            for a in article.authors
        ]

        with self._conn() as conn:
            conn.execute("""
                INSERT INTO articles (id, title, authors_json, keywords_json, keywords_en_json,
                    abstract, abstract_en, journal, doi, year, lang, ref_count, section_count,
                    figure_count, table_count, formula_count, source, original_filename,
                    file_size, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                article_id,
                article.title,
                __import__("json").dumps(authors_json, ensure_ascii=False),
                __import__("json").dumps(article.keywords, ensure_ascii=False),
                __import__("json").dumps(article.keywords_en, ensure_ascii=False),
                article.abstract,
                article.abstract_en,
                article.journal,
                article.doi,
                year,
                article.lang,
                len(article.references),
                len(article.sections),
                len(article.figures) + sum(len(s.figures) for s in article.sections),
                len(article.tables) + sum(len(s.tables) for s in article.sections),
                formula_count,
                source,
                filename,
                file_size,
            ))
            conn.commit()

        # pickle 完整 Article 对象
        pickle_path = os.path.join(self.data_dir, f"{article_id}.pkl")
        with open(pickle_path, "wb") as f:
            pickle.dump(article, f)

        return article_id

    def get_article(self, article_id: str):
        """从 pickle 加载完整 Article 对象"""
        pickle_path = os.path.join(self.data_dir, f"{article_id}.pkl")
        if not os.path.exists(pickle_path):
            return None
        with open(pickle_path, "rb") as f:
            return pickle.load(f)

    def get_meta(self, article_id: str) -> Optional[dict]:
        """获取元数据"""
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
        if not row:
            return None
        return dict(row)

    def list_articles(self, page: int = 1, per_page: int = 10,
                      search: str = "", field: str = "", year: str = "") -> dict:
        """分页搜索列表"""
        conditions = []
        params = []

        if search:
            conditions.append("(title LIKE ? OR authors_json LIKE ? OR abstract LIKE ? OR keywords_json LIKE ?)")
            like = f"%{search}%"
            params.extend([like, like, like, like])

        if field:
            conditions.append("keywords_json LIKE ?")
            params.append(f"%{field}%")

        if year:
            conditions.append("year = ?")
            params.append(int(year))

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with self._conn() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM articles {where}", params).fetchone()[0]
            offset = (page - 1) * per_page
            rows = conn.execute(
                f"SELECT * FROM articles {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                params + [per_page, offset]
            ).fetchall()

        items = []
        for row in rows:
            d = dict(row)
            # 解析 JSON 字段
            import json
            for key in ["authors_json", "keywords_json", "keywords_en_json"]:
                try:
                    d[key.replace("_json", "")] = json.loads(d.pop(key, "[]"))
                except (json.JSONDecodeError, KeyError):
                    d[key.replace("_json", "")] = []
            items.append(d)

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": max(1, (total + per_page - 1) // per_page),
        }

    def get_filter_values(self) -> dict:
        """从已有数据提取可选筛选值（关键词领域 + 年份）"""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT keywords_json, keywords_en_json, year FROM articles"
            ).fetchall()

        import json
        fields = set()
        years = set()
        for row in rows:
            try:
                kw = json.loads(row["keywords_json"])
                fields.update(kw)
            except (json.JSONDecodeError, TypeError):
                pass
            try:
                kw_en = json.loads(row["keywords_en_json"])
                fields.update(kw_en)
            except (json.JSONDecodeError, TypeError):
                pass
            if row["year"]:
                years.add(str(row["year"]))

        return {
            "fields": sorted(fields),
            "years": sorted(years, reverse=True),
        }

    def delete_article(self, article_id: str) -> bool:
        """删除文章"""
        pickle_path = os.path.join(self.data_dir, f"{article_id}.pkl")
        if os.path.exists(pickle_path):
            os.remove(pickle_path)
        with self._conn() as conn:
            conn.execute("DELETE FROM articles WHERE id = ?", (article_id,))
            conn.commit()
        return True

    # ── 辅助 ────────────────────────────────────

    @staticmethod
    def _extract_year(article) -> Optional[int]:
        """从各种来源提取年份"""
        # 尝试从 references 找年份
        for ref in article.references:
            if ref.year and ref.year.isdigit():
                return int(ref.year)
        # 尝试从 abstract 找年份（如 "2024 年"）
        m = re.search(r"(\d{4})\s*年", article.abstract)
        if m:
            return int(m.group(1))
        return None

    @staticmethod
    def _count_formulas(sections) -> int:
        total = 0
        for s in sections:
            total += len(s.formulas)
            total += ArticleStore._count_formulas(s.subsections)
        return total
