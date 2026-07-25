export const CUSTOM_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "CHECKBOX",
  "DROPDOWN",
  "EMAIL",
  "PHONE",
  "URL",
  "PASSWORD",
  "TAG",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Text",
  TEXTAREA: "Textarea",
  NUMBER: "Number",
  DATE: "Date",
  CHECKBOX: "Checkbox",
  DROPDOWN: "Dropdown",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  PASSWORD: "Password",
  TAG: "Tag list",
};

/** Field types that need an `options` list (choices to pick from). */
export const CUSTOM_FIELD_TYPES_WITH_OPTIONS: CustomFieldType[] = ["DROPDOWN"];

export interface CustomFieldDef {
  id: string;
  module: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  hidden: boolean;
  order: number;
}

export type CustomFieldValue = string | number | boolean | string[] | null | undefined;
export type CustomFieldValues = Record<string, CustomFieldValue>;

/** Turns a free-text label into a stable, unique-enough machine key, e.g. "BIOS Version" -> "bios_version". */
export function slugifyFieldKey(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}
