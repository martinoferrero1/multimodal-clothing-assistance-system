from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


TAXONOMY_PATH = Path(__file__).resolve().parents[2] / "data" / "catalog_taxonomy_nested.json"

MASTER_CATEGORY_ALIASES = {
    "accessory": "Accessories",
    "accessories": "Accessories",
}

SUB_CATEGORY_ALIASES = {
    "top": "Topwear",
    "tops": "Topwear",
    "upper wear": "Topwear",
}

ARTICLE_TYPE_ALIASES = {
    "sneaker": "Sports Shoes",
    "sneakers": "Sports Shoes",
    "sport shoes": "Sports Shoes",
    "hoodie": "Sweatshirts",
    "hoodies": "Sweatshirts",
    "sweatshirt": "Sweatshirts",
    "jacket": "Jackets",
    "jackets": "Jackets",
    "t-shirt": "Tshirts",
    "t-shirts": "Tshirts",
    "tshirt": "Tshirts",
    "tshirts": "Tshirts",
    "tee": "Tshirts",
    "tees": "Tshirts",
}


@dataclass(frozen=True)
class TaxonomyPath:
    master_category: str
    sub_category: str
    article_type: str


@dataclass(frozen=True)
class ResolvedTaxonomy:
    master_category: str | None
    sub_category: str | None
    article_type: str | None


def _normalize(value: str | None) -> str:
    if value is None:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return " ".join(value.strip().lower().replace("_", " ").replace("-", " ").split())


@lru_cache(maxsize=1)
def load_catalog_taxonomy() -> dict[str, dict[str, list[str]]]:
    with TAXONOMY_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


@lru_cache(maxsize=1)
def taxonomy_prompt_reference() -> str:
    return json.dumps(load_catalog_taxonomy(), ensure_ascii=False, indent=2)


@lru_cache(maxsize=1)
def _taxonomy_index() -> dict[str, object]:
    taxonomy = load_catalog_taxonomy()

    master_names: dict[str, str] = {}
    sub_names: dict[str, str] = {}
    article_names: dict[str, str] = {}
    paths_by_master: dict[str, list[TaxonomyPath]] = {}
    paths_by_sub: dict[str, list[TaxonomyPath]] = {}
    paths_by_article: dict[str, list[TaxonomyPath]] = {}
    all_paths: list[TaxonomyPath] = []

    for master_category, subcategories in taxonomy.items():
        master_key = _normalize(master_category)
        master_names[master_key] = master_category

        for sub_category, article_types in subcategories.items():
            sub_key = _normalize(sub_category)
            sub_names[sub_key] = sub_category

            for article_type in article_types:
                article_key = _normalize(article_type)
                article_names[article_key] = article_type

                path = TaxonomyPath(
                    master_category=master_category,
                    sub_category=sub_category,
                    article_type=article_type,
                )
                all_paths.append(path)
                paths_by_master.setdefault(master_key, []).append(path)
                paths_by_sub.setdefault(sub_key, []).append(path)
                paths_by_article.setdefault(article_key, []).append(path)

    return {
        "master_names": master_names,
        "sub_names": sub_names,
        "article_names": article_names,
        "paths_by_master": paths_by_master,
        "paths_by_sub": paths_by_sub,
        "paths_by_article": paths_by_article,
        "all_paths": all_paths,
    }


def _canonicalize_master(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _normalize(value)
    aliased = MASTER_CATEGORY_ALIASES.get(normalized)
    if aliased is not None:
        return aliased
    return _taxonomy_index()["master_names"].get(normalized)  # type: ignore[index]


def _canonicalize_sub(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _normalize(value)
    aliased = SUB_CATEGORY_ALIASES.get(normalized)
    if aliased is not None:
        return aliased
    return _taxonomy_index()["sub_names"].get(normalized)  # type: ignore[index]


def _canonicalize_article(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _normalize(value)
    aliased = ARTICLE_TYPE_ALIASES.get(normalized)
    if aliased is not None:
        return aliased
    return _taxonomy_index()["article_names"].get(normalized)  # type: ignore[index]


def _prefer_consistent_paths(
    paths: list[TaxonomyPath],
    *,
    master_category: str | None = None,
    sub_category: str | None = None,
) -> list[TaxonomyPath]:
    filtered = paths

    if sub_category is not None:
        sub_filtered = [path for path in filtered if path.sub_category == sub_category]
        if sub_filtered:
            filtered = sub_filtered

    if master_category is not None:
        master_filtered = [path for path in filtered if path.master_category == master_category]
        if master_filtered:
            filtered = master_filtered

    return filtered


def _unique_or_none(values: set[str]) -> str | None:
    if len(values) == 1:
        return next(iter(values))
    return None


def _clean_singleton_list(values: list[str] | None) -> str | None:
    if not values:
        return None

    for value in values:
        cleaned = value.strip()
        if cleaned:
            return cleaned

    return None


def resolve_taxonomy_hierarchy(
    master_categories: list[str] | None,
    sub_categories: list[str] | None,
    article_types: list[str] | None,
) -> ResolvedTaxonomy:
    master_category = _canonicalize_master(_clean_singleton_list(master_categories))
    sub_category = _canonicalize_sub(_clean_singleton_list(sub_categories))
    article_type = _canonicalize_article(_clean_singleton_list(article_types))

    index = _taxonomy_index()
    paths_by_master = index["paths_by_master"]  # type: ignore[assignment]
    paths_by_sub = index["paths_by_sub"]  # type: ignore[assignment]
    paths_by_article = index["paths_by_article"]  # type: ignore[assignment]

    if article_type is not None:
        article_paths = _prefer_consistent_paths(
            list(paths_by_article.get(_normalize(article_type), [])),
            master_category=master_category,
            sub_category=sub_category,
        )
        resolved_master = _unique_or_none({path.master_category for path in article_paths})
        resolved_sub = _unique_or_none({path.sub_category for path in article_paths})

        if resolved_master is not None and resolved_sub is not None:
            return ResolvedTaxonomy(
                master_category=resolved_master,
                sub_category=resolved_sub,
                article_type=article_type,
            )

        if sub_category is not None:
            return resolve_taxonomy_hierarchy(
                [master_category] if master_category else None,
                [sub_category],
                None,
            )

        if master_category is not None:
            return ResolvedTaxonomy(
                master_category=master_category,
                sub_category=None,
                article_type=None,
            )

        return ResolvedTaxonomy(
            master_category=None,
            sub_category=None,
            article_type=None,
        )

    if sub_category is not None:
        sub_paths = _prefer_consistent_paths(
            list(paths_by_sub.get(_normalize(sub_category), [])),
            master_category=master_category,
        )
        resolved_master = _unique_or_none({path.master_category for path in sub_paths})

        if resolved_master is not None:
            return ResolvedTaxonomy(
                master_category=resolved_master,
                sub_category=sub_category,
                article_type=None,
            )

        if master_category is not None:
            return ResolvedTaxonomy(
                master_category=master_category,
                sub_category=None,
                article_type=None,
            )

        return ResolvedTaxonomy(
            master_category=None,
            sub_category=None,
            article_type=None,
        )

    if master_category is not None:
        has_master = bool(paths_by_master.get(_normalize(master_category)))
        if has_master:
            return ResolvedTaxonomy(
                master_category=master_category,
                sub_category=None,
                article_type=None,
            )

    return ResolvedTaxonomy(
        master_category=None,
        sub_category=None,
        article_type=None,
    )
