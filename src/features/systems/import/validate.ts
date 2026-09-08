import { SYSTEM_STATUSES } from "@/features/systems/schema";
import { TEMPLATE_SAMPLE_ASSET_CODE } from "./constants";
import type { ImportRow, ImportRowInput } from "./types";
import type { ParsedImportRow } from "./parse";

export interface ClassifyContext {
  /** Keyed by lower-cased Asset Code — the primary match/dedupe key for import. */
  existingByAssetCode: Map<string, { id: string; assignedEmployeeId: string | null }>;
  /** Keyed by lower-cased employee full name. A name matching more than one employee is ambiguous and rejected rather than guessed at. */
  employeesByName: Map<string, { id: string; name: string }[]>;
}

/** "vacant" / "Vacant" / "in-repair" all normalize to "VACANT" / "IN_REPAIR" for comparison against SYSTEM_STATUSES. */
export function normalizeStatus(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export type NormalizedYesNo = "Yes" | "No" | null | "INVALID";

/** yes/Yes/YES -> "Yes", no/No/NO -> "No", blank -> null ("not specified"). Anything else is rejected — blank must never become "No". */
export function normalizeYesNo(raw: string): NormalizedYesNo {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === "YES") return "Yes";
  if (upper === "NO") return "No";
  return "INVALID";
}

function validateRow(input: ImportRowInput): string[] {
  const errors: string[] = [];

  const systemName = input.systemName.trim();
  if (!systemName) errors.push("System Name is required.");
  else if (systemName.length > 120) errors.push("System Name must be 120 characters or fewer.");

  const assetCode = input.assetCode.trim();
  if (!assetCode) errors.push("Asset Code is required.");
  else if (assetCode.length > 60) errors.push("Asset Code must be 60 characters or fewer.");

  const keyboard = normalizeYesNo(input.keyboard);
  if (keyboard === "INVALID") errors.push(`Invalid Keyboard value: "${input.keyboard.trim()}" (use Yes, No, or leave blank).`);

  const mousePad = normalizeYesNo(input.mousePad);
  if (mousePad === "INVALID") errors.push(`Invalid Mouse/Mouse Pad value: "${input.mousePad.trim()}" (use Yes, No, or leave blank).`);

  const charger = normalizeYesNo(input.charger);
  if (charger === "INVALID") errors.push(`Invalid Charger value: "${input.charger.trim()}" (use Yes, No, or leave blank).`);

  const statusRaw = input.status.trim();
  if (statusRaw) {
    const normalized = normalizeStatus(statusRaw);
    if (!(SYSTEM_STATUSES as readonly string[]).includes(normalized)) {
      errors.push(`Invalid status: "${statusRaw}" (expected one of ${SYSTEM_STATUSES.join(", ")}).`);
    } else {
      const allocatedName = input.allocatedPersonName.trim();
      if (normalized === "ALLOCATED" && !allocatedName) {
        errors.push("Status ALLOCATED requires an Allocated Person Name.");
      }
      if (normalized === "VACANT" && allocatedName) {
        errors.push("Status VACANT conflicts with an Allocated Person Name — leave Status blank or remove the allocated person.");
      }
    }
  }

  return errors;
}

/**
 * Classifies parsed rows against the current database state (fresh reads,
 * never client-supplied) into NEW / UPDATE / INVALID / DUPLICATE-in-file /
 * SAMPLE, in file order. Asset Code (trimmed, lower-cased) is the primary
 * match/dedupe key.
 */
export function classifyRows(parsedRows: ParsedImportRow[], ctx: ClassifyContext): ImportRow[] {
  const seenAssetCodes = new Map<string, number>();

  return parsedRows.map(({ rowNumber, input }): ImportRow => {
    const assetCodeLower = input.assetCode.trim().toLowerCase();

    if (assetCodeLower === TEMPLATE_SAMPLE_ASSET_CODE.toLowerCase()) {
      return {
        rowNumber,
        input,
        action: "SAMPLE",
        errors: [],
        warnings: ["This is the template's example row — it's always skipped automatically."],
      };
    }

    const errors = validateRow(input);
    const warnings: string[] = [];

    const allocatedName = input.allocatedPersonName.trim();
    if (allocatedName && errors.length === 0) {
      const matches = ctx.employeesByName.get(allocatedName.toLowerCase()) ?? [];
      if (matches.length === 0) {
        errors.push(`Employee "${allocatedName}" was not found in the Employees module — add them first or leave this blank to mark the asset vacant.`);
      } else if (matches.length > 1) {
        errors.push(`"${allocatedName}" matches more than one employee — this can't be linked automatically.`);
      }
    }

    if (errors.length > 0) {
      return { rowNumber, input, action: "INVALID", errors, warnings };
    }

    const firstSeenAtRow = seenAssetCodes.get(assetCodeLower);
    if (firstSeenAtRow !== undefined) {
      return {
        rowNumber,
        input,
        action: "DUPLICATE",
        errors: [`Duplicate Asset Code in this file — already used on row ${firstSeenAtRow}`],
        warnings,
        firstSeenAtRow,
      };
    }
    seenAssetCodes.set(assetCodeLower, rowNumber);

    const existing = ctx.existingByAssetCode.get(assetCodeLower);
    if (existing) {
      return { rowNumber, input, action: "UPDATE", errors: [], warnings, existingSystemId: existing.id };
    }

    return { rowNumber, input, action: "NEW", errors: [], warnings };
  });
}
