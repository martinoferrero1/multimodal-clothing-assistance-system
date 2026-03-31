from schemas.outfit_maker.products_solicitation import ItemSpecList

def format_solicitation(item_spec_list: ItemSpecList) -> str:
    FIELD_LABELS = {
        "usage": "Usage",
        "years": "Year",
        "max_price": "Max price (USD)",
        "gender": "Gender",
        "brands": "Brand",
        "seasons": "Season",
        "base_colors": "Main color",
        "secondary_colors": "Secondary color",
        "master_categories": "Category",
        "sub_categories": "Subcategory",
        "article_types": "Type",
        "product_names": "Product name",
        "images": "Images",
    }

    def format_value(value):
        if isinstance(value, list):
            return ", ".join(str(v) for v in value)
        if isinstance(value, dict):
            return "provided"
        return str(value)

    def get_label(field, value):
        base_label = FIELD_LABELS.get(field, field.replace("_", " ").capitalize())

        if isinstance(value, list) and len(value) == 1:
            if base_label.endswith("s"):
                base_label = base_label[:-1]

        return base_label

    def extract_fields(obj, exclude_fields=None, parent_item=None, internal_item=False):
        exclude_fields = exclude_fields or set()
        lines = []
        parent_data = parent_item.model_dump() if parent_item else {}
        spacing = "\t\t\t" if internal_item else "\t"

        for field, value in obj.model_dump().items():
            if field in exclude_fields or field in (parent_data and parent_data.get(field) == value): # verificar si esta en el padre y tiene el mismo valor
                continue
            if value is None:
                continue
            if isinstance(value, list) and len(value) == 0:
                continue

            label = get_label(field, value)
            formatted_value = format_value(value)

            lines.append(f"{spacing}- {label}: {formatted_value}")

        return lines

    output_lines = ["Ok! Here's a summary of your request, please confirm if it's what you are looking for:\n"]

    for item in item_spec_list.items:
        if item.kind == "outfit":
            output_lines.append(f"- Outfit:")

            outfit_fields = extract_fields(
                item,
                exclude_fields={"items", "kind"}
            )
            output_lines.extend(outfit_fields)

            items = item.items
            if items:
                output_lines.append("\t- Clothing items required:")
                for garment in items:
                    if garment.article_types:
                        name = ", ".join(garment.article_types).capitalize()
                    else:
                        name = "Item"

                    output_lines.append(f"\t\t- {name}:")

                    garment_fields = extract_fields(
                        garment,
                        exclude_fields={"kind", "article_types"},
                        internal_item=True
                    )
                    output_lines.extend(garment_fields)

            output_lines.append("")

        elif item.kind == "garment":
            if item.article_types:
                name = ", ".join(item.article_types).capitalize()
            else:
                name = "Item"

            output_lines.append(f"- {name}:")

            garment_fields = extract_fields(
                item,
                exclude_fields={"kind", "article_types"}
            )
            output_lines.extend(garment_fields)

            output_lines.append("")

    return "\n".join(output_lines).strip()

def build_modifications_extraction_input(solicitations_history: list[str], current_extraction: ItemSpecList, current_msg: str) -> str:
    modifications_list = solicitations_history[1:]
    modifications_list = "\n".join(f"- {h}" for h in modifications_list) if modifications_list else "None"

    return f"""
Original request:
{solicitations_history[0]}

Current specifications (this is the base state to update):
{current_extraction}

Modification history:
{modifications_list}

Latest user message (apply this change):
{current_msg}
"""
