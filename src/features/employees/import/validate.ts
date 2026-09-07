import { z } from "zod";

import { EMPLOYEE_STATUSES } from "@/features/employees/schema";
import { TEMPLATE_SAMPLE_EMAIL } from "./constants";
import type { ImportRow, ImportRowInput } from "./types";
import type { ParsedImportRow } from "./parse";

const emailSchema = z.string().trim().email();

export interface ClassifyContext {
  existingByEmail: Map<string, { id: string; name: string }>;
  categoryIdByName: Map<string, string>;
}

/** "on leave" / "On-Leave" / "on_leave" all normalize to "ON_LEAVE". */
export function normalizeStatus(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/** Accepts ISO (YYYY-MM-DD, incl. the ISO strings exceljs date cells are normalized to) and day-first DD-MM-YYYY / DD/MM/YYYY. */
export function parseImportDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function validateRow(input: ImportRowInput): string[] {
  const errors: string[] = [];

  const name = input.name.trim();
  if (!name) errors.push("Name is required");
  else if (name.length > 120) errors.push("Name must be 120 characters or fewer");

  const department = input.department.trim();
  if (!department) errors.push("Department is required");
  else if (department.length > 60) errors.push("Department must be 60 characters or fewer");

  const email = input.email.trim();
  if (!email) errors.push("Email is required");
  else if (!emailSchema.safeParse(email).success) errors.push(`Invalid email address: "${email}"`);

  const phone = input.phone.trim();
  if (phone) {
    const digits = phone.replace(/[\s()+-]/g, "");
    if (!/^\d{6,20}$/.test(digits)) errors.push(`Invalid phone number: "${phone}"`);
  }

  if (!input.joiningDateRaw.trim()) {
    errors.push("Joining date is required");
  } else if (!parseImportDate(input.joiningDateRaw)) {
    errors.push(`Invalid joining date: "${input.joiningDateRaw}" (use YYYY-MM-DD)`);
  }

  const status = input.status.trim();
  if (status) {
    const normalized = normalizeStatus(status);
    if (!(EMPLOYEE_STATUSES as readonly string[]).includes(normalized)) {
      errors.push(`Invalid status: "${status}" (expected one of ${EMPLOYEE_STATUSES.join(", ")})`);
    }
  }

  if (input.notes.trim().length > 2000) errors.push("Notes must be 2000 characters or fewer");

  return errors;
}

/**
 * Classifies parsed rows against the current database state (fresh reads,
 * never client-supplied) into NEW / UPDATE / INVALID / DUPLICATE-in-file /
 * SAMPLE, in file order. Duplicate-in-file detection and DB matching both
 * key off the trimmed, lower-cased email — SQLite's connector doesn't
 * support Prisma's case-insensitive `mode`, so the comparison happens here.
 */
export function classifyRows(parsedRows: ParsedImportRow[], ctx: ClassifyContext): ImportRow[] {
  const seenEmails = new Map<string, number>();

  return parsedRows.map(({ rowNumber, input }): ImportRow => {
    const email = input.email.trim();
    const emailLower = email.toLowerCase();

    if (emailLower === TEMPLATE_SAMPLE_EMAIL) {
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

    const category = input.category.trim();
    if (category && !ctx.categoryIdByName.has(category.toLowerCase())) {
      warnings.push(`Category "${category}" doesn't exist and will be left blank`);
    }

    if (errors.length > 0) {
      return { rowNumber, input, action: "INVALID", errors, warnings };
    }

    const firstSeenAtRow = seenEmails.get(emailLower);
    if (firstSeenAtRow !== undefined) {
      return {
        rowNumber,
        input,
        action: "DUPLICATE",
        errors: [`Duplicate email in this file — already used on row ${firstSeenAtRow}`],
        warnings,
        firstSeenAtRow,
      };
    }
    seenEmails.set(emailLower, rowNumber);

    const existing = ctx.existingByEmail.get(emailLower);
    if (existing) {
      return { rowNumber, input, action: "UPDATE", errors: [], warnings, existingEmployeeId: existing.id };
    }

    return { rowNumber, input, action: "NEW", errors: [], warnings };
  });
}
