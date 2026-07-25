export function parseJsonValue<T = unknown>(value: string | null | undefined): T | null {
  if (value == null || value === "") return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function serializeJsonValue(value: unknown): string | null {
  if (value == null || value === undefined) return null;
  return JSON.stringify(value);
}

import type { CustomFieldValues } from "@/lib/custom-fields/types";

export function normalizeCustomFields(value: unknown): CustomFieldValues {
  if (value == null || value === undefined) return {};

  if (typeof value === "string") {
    const parsed = parseJsonValue<CustomFieldValues>(value);
    return parsed ?? {};
  }

  if (typeof value === "object") {
    return value as CustomFieldValues;
  }

  return {};
}
