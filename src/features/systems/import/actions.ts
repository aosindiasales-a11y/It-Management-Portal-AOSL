"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { parseImportFile, ImportParseError } from "./parse";
import { classifyRows, normalizeStatus, normalizeYesNo, type ClassifyContext } from "./validate";
import { summarize } from "./types";
import type { ImportPreviewResult, ImportResult, ImportRow, ImportRowInput, ImportRowOutcome } from "./types";
import { ACCEPTED_IMPORT_EXTENSIONS, MAX_IMPORT_FILE_SIZE_BYTES, MAX_IMPORT_FILE_SIZE_MB, MAX_IMPORT_ROWS } from "./constants";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function buildClassifyContext(): Promise<ClassifyContext> {
  const [systems, employees] = await Promise.all([
    prisma.system.findMany({ select: { id: true, assetId: true, assignedEmployeeId: true } }),
    prisma.employee.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
  ]);

  const employeesByName = new Map<string, { id: string; name: string }[]>();
  for (const employee of employees) {
    const key = employee.name.trim().toLowerCase();
    const list = employeesByName.get(key) ?? [];
    list.push(employee);
    employeesByName.set(key, list);
  }

  return {
    existingByAssetCode: new Map(systems.map((s) => [s.assetId.toLowerCase(), { id: s.id, assignedEmployeeId: s.assignedEmployeeId }])),
    employeesByName,
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
export async function previewSystemImport(formData: FormData): Promise<ActionResult<ImportPreviewResult>> {
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
    return { success: false, error: "No asset rows were found in this file." };
  }

  try {
    const ctx = await buildClassifyContext();
    const rows = classifyRows(parsedRows, ctx);
    return { success: true, data: { fileName: uploadedFile.name, summary: summarize(rows), rows } };
  } catch {
    return { success: false, error: "Something went wrong while validating the file. Try again." };
  }
}

/** Resolves the employee (by exact, unique name match — validated during classification) and the status a row should end up with. */
function resolveRow(row: ImportRow, ctx: ClassifyContext): { employeeId: string | null; status: string } {
  const allocatedName = row.input.allocatedPersonName.trim();
  const employeeId = allocatedName ? ctx.employeesByName.get(allocatedName.toLowerCase())?.[0]?.id ?? null : null;
  const statusRaw = row.input.status.trim();
  const status = statusRaw ? normalizeStatus(statusRaw) : employeeId ? "ALLOCATED" : "VACANT";
  return { employeeId, status };
}

/**
 * Re-validates the given rows against the current database (never trusts
 * classification computed client-side during preview) and writes the
 * NEW/UPDATE rows one at a time — each System write is paired with its
 * AllocationHistory/SystemHistoryEntry side effects, which don't fit the
 * chunked-transaction-of-independent-ops pattern used by the Employees
 * importer, so a per-row try/catch keeps one bad row from sinking the batch.
 */
export async function confirmSystemImport(
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

  for (const row of toWrite) {
    try {
      const { employeeId, status } = resolveRow(row, ctx);
      const keyboard = normalizeYesNo(row.input.keyboard);
      const mousePad = normalizeYesNo(row.input.mousePad);
      const charger = normalizeYesNo(row.input.charger);
      const data = {
        name: row.input.systemName.trim(),
        assignedEmployeeId: employeeId,
        status,
        keyboard: keyboard === "INVALID" ? null : keyboard,
        mousePad: mousePad === "INVALID" ? null : mousePad,
        charger: charger === "INVALID" ? null : charger,
      };

      if (row.action === "UPDATE" && row.existingSystemId) {
        const existing = ctx.existingByAssetCode.get(row.input.assetCode.trim().toLowerCase())!;
        // eslint-disable-next-line no-await-in-loop
        await prisma.system.update({ where: { id: row.existingSystemId }, data });

        if (existing.assignedEmployeeId !== employeeId) {
          if (existing.assignedEmployeeId) {
            // eslint-disable-next-line no-await-in-loop
            await prisma.allocationHistory.updateMany({
              where: { systemId: row.existingSystemId, employeeId: existing.assignedEmployeeId, unassignedAt: null },
              data: { unassignedAt: new Date() },
            });
          }
          if (employeeId) {
            // eslint-disable-next-line no-await-in-loop
            await prisma.allocationHistory.create({ data: { systemId: row.existingSystemId, employeeId } });
          }
          // eslint-disable-next-line no-await-in-loop
          await prisma.systemHistoryEntry.create({
            data: { systemId: row.existingSystemId, eventType: "Updated via import", description: employeeId ? "Allocated per bulk import" : "Marked vacant per bulk import" },
          });
        }
        updated += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        const system = await prisma.system.create({ data: { assetId: row.input.assetCode.trim(), ...data } });
        // eslint-disable-next-line no-await-in-loop
        await prisma.systemHistoryEntry.create({
          data: { systemId: system.id, eventType: "Registered", description: "Asset added via bulk import" },
        });
        if (employeeId) {
          // eslint-disable-next-line no-await-in-loop
          await prisma.allocationHistory.create({ data: { systemId: system.id, employeeId } });
        }
        created += 1;
      }
    } catch {
      failures.push({
        rowNumber: row.rowNumber,
        input: row.input,
        status: "FAILED",
        error: "Couldn't save this row. Check the data and try importing it again.",
      });
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
    module: "systems",
    description: `Imported assets from "${fileName}": ${created} created, ${updated} updated, ${invalidRows.length + duplicateRows.length} skipped${
      failures.length ? `, ${failures.length} failed` : ""
    } (${result.result})`,
  });

  revalidatePath("/systems");
  revalidatePath("/dashboard");

  return { success: true, data: result };
}
