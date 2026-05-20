import json
import logging
from pathlib import Path

import pandas as pd

from src.core.logging_config import setup_logging


CSV_PATH = Path("data/clothes.csv")
setup_logging()
logger = logging.getLogger(__name__)

df = pd.read_csv(CSV_PATH)

taxonomy = {}

for _, row in df.iterrows():
    master = str(row["masterCategory"]).strip()
    sub = str(row["subCategory"]).strip()
    article = str(row["articleType"]).strip()

    if not master or not sub or not article:
        continue

    taxonomy.setdefault(master, {})
    taxonomy[master].setdefault(sub, set())
    taxonomy[master][sub].add(article)

taxonomy_json = {
    master: {
        sub: sorted(list(article_types))
        for sub, article_types in sorted(subs.items())
    }
    for master, subs in sorted(taxonomy.items())
}

output_path = Path("data/catalog_taxonomy_nested.json")
output_path.write_text(
    json.dumps(taxonomy_json, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

logger.info("Generated taxonomy with %s master category group(s)", len(taxonomy_json))
logger.debug("Nested taxonomy:\n%s", json.dumps(taxonomy_json, indent=2, ensure_ascii=False))
logger.info("Saved nested taxonomy to: %s", output_path.resolve())
