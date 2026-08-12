import type { SearchPriorityField } from "@/lib/types";
import type { Language, MessageKey, Translator } from "@/lib/i18n";

export const SEARCH_PRIORITY_OPTIONS: Array<{
  field: SearchPriorityField;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
}> = [
  {
    field: "category",
    labelKey: "priority.category",
    descriptionKey: "priority.categoryDescription",
  },
  {
    field: "gender",
    labelKey: "priority.gender",
    descriptionKey: "priority.genderDescription",
  },
  {
    field: "base_colors",
    labelKey: "priority.baseColors",
    descriptionKey: "priority.baseColorsDescription",
  },
  {
    field: "secondary_colors",
    labelKey: "priority.secondaryColors",
    descriptionKey: "priority.secondaryColorsDescription",
  },
  {
    field: "season",
    labelKey: "priority.season",
    descriptionKey: "priority.seasonDescription",
  },
  {
    field: "max_price",
    labelKey: "priority.maxPrice",
    descriptionKey: "priority.maxPriceDescription",
  },
];

export function togglePriorityField(
  fields: SearchPriorityField[],
  field: SearchPriorityField,
) {
  if (fields.includes(field)) {
    return fields.filter((currentField) => currentField !== field);
  }
  return [...fields, field];
}

export function formatPriorityFields(
  fields: SearchPriorityField[],
  language: Language,
  t: Translator,
) {
  if (fields.length === 0) {
    return t("priority.none");
  }

  const labelsByField = new Map(
    SEARCH_PRIORITY_OPTIONS.map((option) => [option.field, t(option.labelKey)]),
  );

  return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(
    fields.map((field) => labelsByField.get(field) ?? field),
  );
}
