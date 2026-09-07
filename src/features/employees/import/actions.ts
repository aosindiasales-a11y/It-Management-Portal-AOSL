"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { parseImportFile, ImportParseError } from "./parse";
import { classifyRows, normalizeStatus, parseImportDate, type ClassifyContext } from "./validate";
import { summarize } from "./types";
import type { ImportPreviewResult, ImportResult, ImportRow, ImportRowInput, ImportRowOutcome } from "./types";
import { ACCEPTED_IMPORT_EXTENSIONS, MAX_IMPORT_FILE_SIZE_BYTES, MAX_IMPORT_FILE_SIZE_MB, MAX_IMPORT_ROWS } from "./constants";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function buildClassifyContext(): Promise<ClassifyContext> {
  const [employees, categories] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, email: true, name: true } }),
    prisma.category.findMany({ where: { module: "employees" }, select: { id: true, name: true } }),
  ]);

  return {
    existingByEmail: new Map(employees.map((e) => [e.email.toLowerCase(), { id: e.id, name: e.name }])),
    categoryIdByName: new Map(categories.map((c) => [c.name.toLowerCase(), c.id])),
  };
}

function validateUpload(file: File | null): string | null {
  if (!file || file.size === 0) return "Choose a file to import.";
  const extension = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_IMPORT_EXTENSIONS.includes(extension)) {
    return "Unsupported file type. Upload a .xlsx, .xls or .csv file.";
  }
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return `${file.name} is larger than ${MAX_IMPORT_FILE_SIZE_MB} MB.`;
  }
  return null;
}

/** Reads and validates an uploaded file, returning a row-by-row preview. Read-only — nothing is written yet. */
export async function previewEmployeeImport(formData: FormData): Promise<ActionResult<ImportPreviewResult>> {
  await requireAdmin();

  const file = formData.get("file");
  const uploadError = validateUpload(file instanceof File ? file : null);
  if (uploadError) return { success: false, error: uploadError };
  const uploadedFile = file as File;

  let parsedRows;
  try {
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    parsedRows = await parseImportFile(buffer, uploadedFile.name);
  } catch (error) {
    return { success: false, error: error instanceof ImportParseError ? error.message : "Couldn't read this file." };
  }

  if (parsedRows.length === 0) {
    return { success: false, error: "No employee rows were found in this file." };
  }

  try {
    const ctx = await buildClassifyContext();
    const rows = classifyRows(parsedRows, ctx);
    return { success: true, data: { fileName: uploadedFile.name, summary: summarize(rows), rows } };
  } catch {
    return { success: false, error: "Something went wrong while validating the file. Try again." };
  }
}

function buildCreateData(row: ImportRow, ctx: ClassifyContext): Prisma.EmployeeCreateInput {
  const { input } = row;
  const status = input.status.trim();
  const phone = input.phone.trim();
  const notes = input.notes.trim();
  const category = input.category.trim();

  return {
    name: input.name.trim(),
    department: input.department.trim(),
    email: input.email.trim(),
    joiningDate: parseImportDate(input.joiningDateRaw)!,
    status: status ? normalizeStatus(status) : "ACTIVE",
    phone: phone || null,
    notes: notes || null,
    categoryId: category ? ctx.categoryIdByName.get(category.toLowerCase()) ?? null : null,
    customFields: null,
  };
}

/** Blank optional cells on an UPDATE row leave the existing value untouched rather than clearing it. */
function buildUpdateData(row: ImportRow, ctx: ClassifyContext): Prisma.EmployeeUpdateInput {
  const { input } = row;
  const status = input.status.trim();
  const phone = input.phone.trim();
  const notes = input.notes.trim();
  const category = input.category.trim();

  const data: Prisma.EmployeeUpdateInput = {
    name: input.name.trim(),
    department: input.department.trim(),
    email: input.email.trim(),
    joiningDate: parseImportDate(input.joiningDateRaw)!,
  };
  if (status) data.status = normalizeStatus(status);
  if (phone) data.phone = phone;
  if (notes) data.notes = notes;
  if (category) data.categoryId = ctx.categoryIdByName.get(category.toLowerCase()) ?? null;
  return data;
}

function buildWriteOp(row: ImportRow, ctx: ClassifyContext) {
  if (row.action === "UPDATE" && row.existingEmployeeId) {
    return prisma.employee.update({ where: { id: row.existingEmployeeId }, data: buildUpdateData(row, ctx) });
  }
  return prisma.employee.create({ data: buildCreateData(row, ctx) });
}

const WRITE_CHUNK_SIZE = 50;

/**
 * Re-validates the given rows against the current database (never trusts
 * classification computed client-side during preview) and bulk writes the
 * NEW/UPDATE rows. Writes happen in chunked transactions for efficiency; a
 * chunk that fails falls back to one-by-one writes so a single bad row
 * can't sink otherwise-valid rows in the same batch.
 */
export async function confirmEmployeeImport(
  fileName: string,
  rowInputs: { rowNumber: number; input: ImportRowInput }[]
): Promise<ActionResult<ImportResult>> {
  await requireAdmin();

  if (!Array.isArray(rowInputs) || rowInputs.length === 0) {
    return { success: false, error: "Nothing to import." };
  }
  if (rowInputs.length > MAX_IMPORT_ROWS) {
    return { success: false, error: `Too many rows (max ${MAX_IMPORT_ROWS}).` };
  }

  let ctx: ClassifyContext;
  let rows: ImportRow[];
  try {
    ctx = await buildClassifyContext();
    rows = classifyRows(rowInputs, ctx);
  } catch {
    return { success: false, error: "Something went wrong while validating the file. Try again." };
  }

  const toWrite = rows.filter((row) => row.action === "NEW" || row.action === "UPDATE");
  const invalidRows = rows.filter((row) => row.action === "INVALID");
  const duplicateRows = rows.filter((row) => row.action === "DUPLICATE");
  const sampleRows = rows.filter((row) => row.action === "SAMPLE");

  let created = 0;
  let updated = 0;
  const failures: ImportRowOutcome[] = [];

  for (let i = 0; i < toWrite.length; i += WRITE_CHUNK_SIZE) {
    const chunk = toWrite.slice(i, i + WRITE_CHUNK_SIZE);
    try {
      await prisma.$transaction(chunk.map((row) => buildWriteOp(row, ctx)));
      for (const row of chunk) {
        if (row.action === "NEW") created += 1;
        else updated += 1;
      }
    } catch {
      for (const row of chunk) {
        try {
          await buildWriteOp(row, ctx);
          if (row.action === "NEW") created += 1;
          else updated += 1;
        } catch {
          failures.push({
            rowNumber: row.rowNumber,
            input: row.input,
            status: "FAILED",
            error: "Couldn't save this row. Check the data and try importing it again.",
          });
        }
      }
    }
  }

  const failureOutcomes: ImportRowOutcome[] = [
    ...invalidRows.map((row): ImportRowOutcome => ({ rowNumber: row.rowNumber, input: row.input, status: "FAILED", error: row.errors.join("; ") })),
    ...duplicateRows.map((row): ImportRowOutcome => ({ rowNumber: row.rowNumber, input: row.input, status: "FAILED", error: row.errors.join("; ") })),
    ...failures,
  ];

  const result: ImportResult = {
    fileName,
    totalRows: rows.length,
    created,
    updated,
    skippedInvalid: invalidRows.length,
    skippedDuplicate: duplicateRows.length,
    skippedSample: sampleRows.length,
    failed: failures.length,
    result: failures.length === 0 ? "SUCCESS" : created + updated > 0 ? "PARTIAL" : "FAILED",
    failures: failureOutcomes,
  };

  await logActivity({
    action: "imported",
    module: "employees",
    description: `Imported employees from "${fileName}": ${created} created, ${updated} updated, ${invalidRows.length + duplicateRows.length} skipped${
      failures.length ? `, ${failures.length} failed` : ""
    } (${result.result})`,
  });

  revalidatePath("/employees");
  revalidatePath("/dashboard");

  return { success: true, data: result };
}
