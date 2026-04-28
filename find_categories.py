from pathlib import Path
import json
import pandas as pd

CSV_PATH = Path("data/clothes.csv")

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

print(json.dumps(taxonomy_json, indent=2, ensure_ascii=False))
print(f"\nSaved nested taxonomy to: {output_path.resolve()}")