/**
 * Shared types for the Employees bulk-import feature. Kept separate from
 * schema.ts / actions.ts so both the (non-"use server") parsing/validation
 * helpers and the server actions can import them.
 */

export type ImportRowAction = "NEW" | "UPDATE" | "INVALID" | "DUPLICATE" | "SAMPLE";

/** Normalized-but-unvalidated text pulled from one spreadsheet row. */
export interface ImportRowInput {
  employeeId: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  /** Raw cell text/date as read from the sheet, before date parsing. */
  dateOfBirthRaw: string;
  joiningDateRaw: string;
  status: string;
  category: string;
  notes: string;
}

export interface ImportRow {
  /** 1-based spreadsheet row number (header is row 1), for user-facing messages. */
  rowNumber: number;
  input: ImportRowInput;
  action: ImportRowAction;
  errors: string[];
  warnings: string[];
  /** Set when action is "UPDATE" — the existing Employee.id being updated. */
  existingEmployeeId?: string;
  /** Set when action is "DUPLICATE" — the earlier row number this email already appeared on. */
  firstSeenAtRow?: number;
}

export interface ImportSummary {
  total: number;
  newCount: number;
  updateCount: number;
  invalidCount: number;
  duplicateCount: number;
  sampleCount: number;
}

export interface ImportPreviewResult {
  fileName: string;
  summary: ImportSummary;
  rows: ImportRow[];
}

export interface ImportRowOutcome {
  rowNumber: number;
  input: ImportRowInput;
  status: "CREATED" | "UPDATED" | "FAILED";
  error?: string;
}

export interface ImportResult {
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  skippedSample: number;
  failed: number;
  result: "SUCCESS" | "PARTIAL" | "FAILED";
  failures: ImportRowOutcome[];
}

export function summarize(rows: ImportRow[]): ImportSummary {
  return {
    total: rows.length,
    newCount: rows.filter((r) => r.action === "NEW").length,
    updateCount: rows.filter((r) => r.action === "UPDATE").length,
    invalidCount: rows.filter((r) => r.action === "INVALID").length,
    duplicateCount: rows.filter((r) => r.action === "DUPLICATE").length,
    sampleCount: rows.filter((r) => r.action === "SAMPLE").length,
  };
}
