/** Limits + header mapping for the Systems/Assets bulk-import feature. */

export const MAX_IMPORT_FILE_SIZE_MB = 5;
export const MAX_IMPORT_FILE_SIZE_BYTES = MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024;

/** Data rows (excluding the header row) accepted in a single import file. */
export const MAX_IMPORT_ROWS = 2000;

export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"];

/**
 * The example row shipped in the downloadable template is recognized by
 * this Asset Code and always skipped ("SAMPLE"), so it can never be
 * imported even if an admin forgets to delete it before uploading.
 */
export const TEMPLATE_SAMPLE_ASSET_CODE = "AOSL/Asset/SAMPLE/0000";

/** Canonical import fields — exactly the columns the spec requires, no more. Password/credential is deliberately never one of these. */
export type ImportField = "systemName" | "allocatedPersonName" | "assetCode" | "keyboard" | "mousePad" | "charger" | "status";

/** Accepted header text per field (case/space/punctuation-insensitive — see normalizeHeader in parse.ts). */
export const IMPORT_FIELD_HEADERS: Record<ImportField, string[]> = {
  systemName: ["System Name", "Asset Name", "Name"],
  allocatedPersonName: ["Allocated Person Name", "Allocated To", "Assigned To", "Employee Name"],
  assetCode: ["Asset Code", "Asset ID", "Asset Tag"],
  keyboard: ["Keyboard"],
  mousePad: ["Mouse/Mouse Pad", "Mouse / Mouse Pad", "Mouse Pad", "Mouse"],
  charger: ["Charger"],
  status: ["Status"],
};

export const IMPORT_TEMPLATE_COLUMNS: { field: ImportField; header: string; required: boolean }[] = [
  { field: "systemName", header: "System Name", required: true },
  { field: "allocatedPersonName", header: "Allocated Person Name", required: false },
  { field: "assetCode", header: "Asset Code", required: true },
  { field: "keyboard", header: "Keyboard", required: false },
  { field: "mousePad", header: "Mouse/Mouse Pad", required: false },
  { field: "charger", header: "Charger", required: false },
  { field: "status", header: "Status", required: false },
];
