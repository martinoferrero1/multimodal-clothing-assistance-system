from pathlib import Path
import pandas as pd

from infra.db.database import Database
from infra.db.models import (
    Gender, MasterCategory, SubCategory, ArticleType,
    Color, Brand, Season, Product
)

CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "clothes.csv"


def get_or_create(session, model, **kwargs):
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance

    instance = model(**kwargs)
    session.add(instance)
    session.flush()
    return instance


def seed_catalog():
    print("CSV path:", CSV_PATH.resolve())
    print("CSV exists:", CSV_PATH.exists())

    df = pd.read_csv(CSV_PATH)
    print("Rows:", len(df))
    print("Columns:", list(df.columns))

    db = Database()

    with db.get_session() as session:
        for _, row in df.iterrows():
            gender = get_or_create(session, Gender, name=str(row["gender"]))
            master = get_or_create(session, MasterCategory, name=str(row["masterCategory"]))

            sub = session.query(SubCategory).filter_by(
                name=str(row["subCategory"]),
                master_category_id=master.id,
            ).first()
            if not sub:
                sub = SubCategory(name=str(row["subCategory"]), master_category=master)
                session.add(sub)
                session.flush()

            article = session.query(ArticleType).filter_by(
                name=str(row["articleType"]),
                sub_category_id=sub.id,
            ).first()
            if not article:
                article = ArticleType(name=str(row["articleType"]), sub_category=sub)
                session.add(article)
                session.flush()

            brand = get_or_create(session, Brand, name=str(row["brand"]))
            season = get_or_create(session, Season, name=str(row["season"]))
            base_colour = get_or_create(session, Color, name=str(row["baseColour"]))

            colour1 = None
            if pd.notna(row.get("colour1")):
                colour1 = get_or_create(session, Color, name=str(row["colour1"]))

            colour2 = None
            if pd.notna(row.get("colour2")):
                colour2 = get_or_create(session, Color, name=str(row["colour2"]))

            product = Product(
                product_display_name=str(row["productDisplayName"]),
                year=int(row["year"]) if pd.notna(row["year"]) else None,
                usage=str(row["usage"]) if pd.notna(row["usage"]) else None,
                #availability=int(row.get("availability", 1)),
                price=float(row.get("price", 1)),
                gender=gender,
                master_category=master,
                sub_category=sub,
                article_type=article,
                brand=brand,
                season=season,
                base_colour=base_colour,
                colour1=colour1,
                colour2=colour2,
                image_top=row.get("image_top"),
                image_back=row.get("image_back"),
                image_search=row.get("image_search"),
                image_default=row.get("image_default"),
                image_left=row.get("image_left"),
                image_front=row.get("image_front"),
                image_right=row.get("image_right"),
            )

            session.add(product)

        session.commit()

        print("Products:", session.query(Product).count())