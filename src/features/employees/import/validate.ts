import { z } from "zod";

import { EMPLOYEE_STATUSES } from "@/features/employees/schema";
import { TEMPLATE_SAMPLE_EMAIL, TEMPLATE_SAMPLE_EMPLOYEE_ID } from "./constants";
import type { ImportRow, ImportRowInput } from "./types";
import type { ParsedImportRow } from "./parse";

const emailSchema = z.string().trim().email();

export interface ClassifyContext {
  /** Keyed by lower-cased Employee ID — the primary match/dedupe key for import. */
  existingByEmployeeId: Map<string, { id: string; name: string }>;
  /** Keyed by lower-cased email — used only to catch a row's email colliding with a *different* employee's email before it hits the DB's unique constraint. */
  existingByEmail: Map<string, { id: string; name: string }>;
  categoryIdByName: Map<string, string>;
}

/** "on leave" / "On-Leave" / "on_leave" all normalize to "ON_LEAVE". */
export function normalizeStatus(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/** 2-digit years follow the common strptime "%y" pivot: 00-68 -> 20xx, 69-99 -> 19xx. */
function expandTwoDigitYear(yy: number): number {
  return yy <= 68 ? 2000 + yy : 1900 + yy;
}

/** Builds a UTC date and rejects overflow (e.g. day 31 in a 30-day month) instead of silently rolling into the next month. */
function makeUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * Accepts ISO (YYYY-MM-DD, incl. the ISO strings exceljs date cells are
 * normalized to), day-first numeric DD-MM-YYYY / DD/MM/YYYY (2- or 4-digit
 * year), and day-first month-name DD-MMM-YYYY / DD MMM YY (e.g. "4-Feb-17",
 * "14 April 2025") — the format most spreadsheet exports use for dates.
 */
export function parseImportDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return makeUtcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  if (dmy) {
    const [, dayText, monthText, yearText] = dmy as unknown as [string, string, string, string];
    const day = Number(dayText);
    const month = Number(monthText) - 1;
    const year = yearText.length === 2 ? expandTwoDigitYear(Number(yearText)) : Number(yearText);
    return makeUtcDate(year, month, day);
  }

  const dmyName = trimmed.match(/^(\d{1,2})[\s.-]+([A-Za-z]{3,9})[\s.,-]+(\d{2}|\d{4})$/);
  if (dmyName) {
    const [, dayText, monthText, yearText] = dmyName as unknown as [string, string, string, string];
    const month = MONTH_NAMES[monthText.toLowerCase()];
    if (month === undefined) return null;
    const day = Number(dayText);
    const year = yearText.length === 2 ? expandTwoDigitYear(Number(yearText)) : Number(yearText);
    return makeUtcDate(year, month, day);
  }

  return null;
}

/**
 * Strips stray characters spreadsheets/PDF copy-paste often leave behind
 * (stray "?" from a rendered phone-icon glyph, bullets, etc.), keeping only
 * digits and standard phone punctuation. Used both to validate and to store
 * the value, so junk characters never reach the database.
 */
export function cleanPhone(raw: string): string {
  return raw.trim().replace(/[^\d+\-\s()]/g, "");
}

function validateRow(input: ImportRowInput): string[] {
  const errors: string[] = [];

  const employeeId = input.employeeId.trim();
  if (!employeeId) errors.push("Employee ID is required.");
  else if (employeeId.length > 50) errors.push("Employee ID must be 50 characters or fewer");

  const name = input.name.trim();
  if (!name) errors.push("Employee Name is required.");
  else if (name.length > 120) errors.push("Employee Name must be 120 characters or fewer");

  const department = input.department.trim();
  if (!department) errors.push("Department is required");
  else if (department.length > 60) errors.push("Department must be 60 characters or fewer");

  const email = input.email.trim();
  if (!email) errors.push("Email is required");
  else if (!emailSchema.safeParse(email).success) errors.push(`Invalid email address: "${email}"`);

  const phone = cleanPhone(input.phone);
  if (phone) {
    const digits = phone.replace(/[\s()+-]/g, "");
    if (!/^\d{6,20}$/.test(digits)) errors.push(`Invalid phone number: "${input.phone.trim()}"`);
  }

  if (!input.dateOfBirthRaw.trim()) {
    errors.push("Date of Birth is required.");
  } else {
    const dob = parseImportDate(input.dateOfBirthRaw);
    if (!dob) errors.push("Invalid Date of Birth format.");
    else if (dob.getTime() > Date.now()) errors.push("Date of Birth cannot be in the future.");
  }

  if (!input.joiningDateRaw.trim()) {
    errors.push("Joining date is required");
  } else if (!parseImportDate(input.joiningDateRaw)) {
    errors.push(`Invalid joining date: "${input.joiningDateRaw}" (use YYYY-MM-DD, DD-MM-YYYY or DD-MMM-YYYY)`);
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
 * SAMPLE, in file order. Employee ID (trimmed, lower-cased) is the primary
 * match/dedupe key — SQLite's connector doesn't support Prisma's
 * case-insensitive `mode`, so the comparison happens here. A row whose email
 * belongs to a *different* existing employee than the one its Employee ID
 * matched is rejected as INVALID rather than left to fail at the database's
 * unique constraint during the write.
 */
export function classifyRows(parsedRows: ParsedImportRow[], ctx: ClassifyContext): ImportRow[] {
  const seenEmployeeIds = new Map<string, number>();

  return parsedRows.map(({ rowNumber, input }): ImportRow => {
    const employeeIdLower = input.employeeId.trim().toLowerCase();
    const emailLower = input.email.trim().toLowerCase();

    if (employeeIdLower === TEMPLATE_SAMPLE_EMPLOYEE_ID.toLowerCase() || emailLower === TEMPLATE_SAMPLE_EMAIL) {
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

    const firstSeenAtRow = seenEmployeeIds.get(employeeIdLower);
    if (firstSeenAtRow !== undefined) {
      return {
        rowNumber,
        input,
        action: "DUPLICATE",
        errors: [`Duplicate Employee ID in this file — already used on row ${firstSeenAtRow}`],
        warnings,
        firstSeenAtRow,
      };
    }
    seenEmployeeIds.set(employeeIdLower, rowNumber);

    const existingById = ctx.existingByEmployeeId.get(employeeIdLower);
    const existingByEmail = ctx.existingByEmail.get(emailLower);

    if (existingByEmail && (!existingById || existingByEmail.id !== existingById.id)) {
      return {
        rowNumber,
        input,
        action: "INVALID",
        errors: [`Email "${input.email.trim()}" is already used by another employee`],
        warnings,
      };
    }

    if (existingById) {
      return { rowNumber, input, action: "UPDATE", errors: [], warnings, existingEmployeeId: existingById.id };
    }

    return { rowNumber, input, action: "NEW", errors: [], warnings };
  });
}
