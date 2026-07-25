import { z } from "zod";

import type { CustomFieldDef, CustomFieldValue, CustomFieldValues } from "@/lib/custom-fields/types";

export const customFieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null(), z.undefined()]);
export const customFieldValuesSchema: z.ZodType<CustomFieldValues> = z.record(z.string(), customFieldValueSchema);

/** Builds a Zod schema for a module's custom fields from its field definitions, for both client and server validation. */
export function buildCustomFieldsSchema(defs: CustomFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const def of defs) {
    let schema: z.ZodTypeAny;

    switch (def.fieldType) {
      case "NUMBER":
        schema = z.coerce.number({ invalid_type_error: `${def.label} must be a number` });
        break;
      case "CHECKBOX":
        schema = z.boolean();
        break;
      case "EMAIL":
        schema = z.string().email(`${def.label} must be a valid email`).or(z.literal(""));
        break;
      case "URL":
        schema = z.string().url(`${def.label} must be a valid URL`).or(z.literal(""));
        break;
      case "TAG":
        schema = z.array(z.string());
        break;
      case "DATE":
      case "TEXT":
      case "TEXTAREA":
      case "PHONE":
      case "PASSWORD":
      case "DROPDOWN":
      default:
        schema = z.string();
        break;
    }

    if (!def.required) {
      schema = schema.optional().nullable();
    } else if (def.fieldType !== "CHECKBOX" && def.fieldType !== "NUMBER" && def.fieldType !== "TAG") {
      schema = (schema as z.ZodString).min(1, `${def.label} is required`);
    }

    shape[def.key] = schema;
  }

  // .passthrough() so a field removed from the definitions after a record
  // was saved doesn't fail validation on that record's next unrelated edit.
  return z.object(shape).passthrough();
}

export type CustomFieldsSchema = ReturnType<typeof buildCustomFieldsSchema>;
