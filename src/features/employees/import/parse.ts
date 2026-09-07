import "server-only";

import { Readable } from "node:stream";
import ExcelJS from "exceljs";

import { IMPORT_FIELD_HEADERS, MAX_IMPORT_ROWS, type ImportField } from "./constants";
import type { ImportRowInput } from "./types";

export class ImportParseError extends Error {}

function normalizeHeader(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const HEADER_LOOKUP = new Map<string, ImportField>();
for (const [field, headers] of Object.entries(IMPORT_FIELD_HEADERS) as [ImportField, string[]][]) {
  for (const header of headers) HEADER_LOOKUP.set(normalizeHeader(header), field);
}

/**
 * Reads a cell's effective text. Formula cells resolve to their cached
 * `.result` (never the formula itself, and never evaluated — exceljs does
 * not execute formulas either way) so nothing derived from a spreadsheet
 * formula is ever treated as trusted input.
 */
function cellToText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result != null) return cellToText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    return "";
  }
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

export interface ParsedImportRow {
  rowNumber: number;
  input: ImportRowInput;
}

/**
 * Parses an uploaded .xlsx or .csv buffer into structured rows. Reads only
 * the first worksheet, normalizes header text against known aliases, trims
 * every cell, and skips fully-blank rows. Legacy binary .xls is not
 * supported by exceljs (it only understands the zip/xml xlsx format and
 * csv) — callers get a clear error asking to re-save as .xlsx or .csv.
 */
export async function parseImportFile(buffer: Buffer, fileName: string): Promise<ParsedImportRow[]> {
  const isCsv = /\.csv$/i.test(fileName);
  const workbook = new ExcelJS.Workbook();

  let worksheet: ExcelJS.Worksheet | undefined;
  try {
    if (isCsv) {
      worksheet = await workbook.csv.read(Readable.from(buffer));
    } else {
      // exceljs ships its own ambient `Buffer` shim that conflicts with @types/node's —
      // this sidesteps that third-party typing clash at this one call boundary.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      worksheet = workbook.worksheets[0];
    }
  } catch {
    throw new ImportParseError(
      isCsv
        ? "Couldn't read this CSV file. Make sure it's a plain comma-separated file and try again."
        : "Couldn't read this Excel file. It may be corrupted, password-protected, or saved in the legacy .xls format — try saving it as .xlsx or .csv and uploading again."
    );
  }

  if (!worksheet || worksheet.rowCount === 0) {
    throw new ImportParseError("This file doesn't contain any rows.");
  }

  const columnFields: (ImportField | null)[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const text = cellToText(cell.value);
    columnFields[colNumber] = text ? HEADER_LOOKUP.get(normalizeHeader(text)) ?? null : null;
  });

  const requiredFields: ImportField[] = ["employeeId", "name", "dateOfBirth", "department", "email", "joiningDate"];
  const missing = requiredFields.filter((field) => !columnFields.includes(field));
  if (missing.length > 0) {
    throw new ImportParseError(
      `Missing required column${missing.length > 1 ? "s" : ""}: ${missing
        .map((field) => IMPORT_FIELD_HEADERS[field][0])
        .join(", ")}. Download the template to see the expected headers.`
    );
  }

  const rows: ParsedImportRow[] = [];
  let dataRowCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values: Partial<Record<ImportField, string>> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const field = columnFields[colNumber];
      if (!field) return;
      values[field] = cellToText(cell.value);
    });

    const isBlankRow = Object.values(values).every((value) => !value);
    if (isBlankRow) return;

    dataRowCount += 1;
    if (dataRowCount > MAX_IMPORT_ROWS) {
      throw new ImportParseError(
        `This file has more than ${MAX_IMPORT_ROWS} data rows. Split it into smaller files and import them separately.`
      );
    }

    rows.push({
      rowNumber,
      input: {
        employeeId: values.employeeId ?? "",
        name: values.name ?? "",
        department: values.department ?? "",
        email: values.email ?? "",
        phone: values.phone ?? "",
        dateOfBirthRaw: values.dateOfBirth ?? "",
        joiningDateRaw: values.joiningDate ?? "",
        status: values.status ?? "",
        category: values.category ?? "",
        notes: values.notes ?? "",
      },
    });
  });

  return rows;
}
