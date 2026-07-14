import type { SearchPriorityField } from "@/lib/types";

export const SEARCH_PRIORITY_OPTIONS: Array<{
  field: SearchPriorityField;
  label: string;
  description: string;
}> = [
  {
    field: "category",
    label: "Category",
    description: "Prefer the deepest garment category detected.",
  },
  {
    field: "gender",
    label: "Gender",
    description: "Keep matches aligned with the requested gender.",
  },
  {
    field: "base_colors",
    label: "Main color",
    description: "Treat the primary color as a hard preference.",
  },
  {
    field: "secondary_colors",
    label: "Secondary color",
    description: "Use accent colors as a hard preference.",
  },
  {
    field: "season",
    label: "Season",
    description: "Keep results inside requested seasons.",
  },
  {
    field: "max_price",
    label: "Max price",
    description: "Exclude products above the requested budget.",
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

export function formatPriorityFields(fields: SearchPriorityField[]) {
  if (fields.length === 0) {
    return "No priority fields";
  }

  const labelsByField = new Map(
    SEARCH_PRIORITY_OPTIONS.map((option) => [option.field, option.label]),
  );

  return fields.map((field) => labelsByField.get(field) ?? field).join(", ");
}
