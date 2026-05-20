import csv
import json
import logging
from pathlib import Path

from src.core.logging_config import setup_logging


BASE_DIR = Path("data")
COMPLETE_INFORMATION_DIR = BASE_DIR / "styles"
INPUT_CSV = BASE_DIR / "styles.csv"
OUTPUT_CSV = BASE_DIR / "clothes.csv"

IMAGE_KEYS = ["top", "back", "search", "default", "left", "front", "right"]
PROGRESS_LOG_INTERVAL = 500

setup_logging()
logger = logging.getLogger(__name__)

with open(INPUT_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    fieldnames = [fn for fn in reader.fieldnames if fn is not None]

# Nuevas columnas
new_columns = ["brand", "colour1", "colour2"] + [f"image_{k}" for k in IMAGE_KEYS]
output_fields = fieldnames + new_columns

enriched_rows = []

total_rows = len(rows)
logger.info("Starting CSV enrichment for %s row(s)", total_rows)
for file_number, row in enumerate(rows, start=1):
    if file_number == 1 or file_number % PROGRESS_LOG_INTERVAL == 0 or file_number == total_rows:
        logger.info("Processing row %s/%s", file_number, total_rows)

    # Eliminar columnas sin nombre (None)
    row = {k: v for k, v in row.items() if k is not None}

    item_id = row["id"]
    json_path = COMPLETE_INFORMATION_DIR / f"{item_id}.json"

    brand = ""
    colour1 = ""
    colour2 = ""
    images = {k: "" for k in IMAGE_KEYS}

    if json_path.exists():
        with open(json_path, encoding="utf-8") as jf:
            data = json.load(jf).get("data", {})

            brand = data.get("brandName", "")
            colour1 = data.get("colour1", "")
            colour2 = data.get("colour2", "")

            style_images = data.get("styleImages", {})
            for key in IMAGE_KEYS:
                if key in style_images:
                    resolutions = style_images[key].get("resolutions", {})
                    images[key] = resolutions.get("1080X1440", "")

    # Agregar al row original
    row["brand"] = brand
    row["colour1"] = colour1
    row["colour2"] = colour2
    for k in IMAGE_KEYS:
        row[f"image_{k}"] = images[k]

    enriched_rows.append(row)

with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=output_fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(enriched_rows)

logger.info("CSV generated successfully: %s", OUTPUT_CSV)
