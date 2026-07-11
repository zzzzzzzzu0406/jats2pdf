"""文章存储元数据回归测试。"""

from pathlib import Path

from src.parser.jats_parser import JATSParser
from src.store import ArticleStore


ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "sample1.xml"


def test_recursive_counts_publication_year_and_file_size(tmp_path):
    store = ArticleStore(
        db_path=str(tmp_path / "articles.db"),
        data_dir=str(tmp_path / "articles"),
    )
    store.init_db()
    article = JATSParser(str(SAMPLE)).parse()
    article_id = store.add_article(
        article,
        filename=SAMPLE.name,
        source="test",
        filepath=str(SAMPLE),
    )

    meta = store.get_meta(article_id)
    assert meta["year"] == 2024
    assert meta["figure_count"] == 1
    assert meta["table_count"] == 1
    assert meta["formula_count"] == 2  # 1 个块公式 + 1 个行内公式
    assert meta["file_size"] == SAMPLE.stat().st_size
    assert store.list_articles(year=2024)["total"] == 1
