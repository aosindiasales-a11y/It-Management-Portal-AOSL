import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { getCurrentAdmin } from "@/lib/auth/dal";
import { EMPLOYEE_STATUSES } from "@/features/employees/schema";
import { IMPORT_TEMPLATE_COLUMNS, TEMPLATE_SAMPLE_EMAIL } from "@/features/employees/import/constants";

/** The downloadable "Import Employees" template — mirrors src/app/api/backup for binary file streaming outside the server-action CRUD path. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");

  const headers = IMPORT_TEMPLATE_COLUMNS.map((c) => c.header);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  sheet.addRow([
    "Jane Doe",
    "Sales",
    TEMPLATE_SAMPLE_EMAIL,
    "+1 555 0100",
    "2024-01-15",
    "ACTIVE",
    "",
    "Example row — always skipped automatically, delete or leave as-is",
  ]);
  sheet.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const notesSheet = workbook.addWorksheet("Instructions");
  notesSheet.addRow(["How to use this template"]);
  notesSheet.getRow(1).font = { bold: true, size: 13 };
  notesSheet.addRows([
    [""],
    ["1. Fill in one row per employee on the \"Employees\" sheet. Keep the header row as-is."],
    ["2. Row 2 is example data — it's recognized automatically and never imported, even if you forget to delete it."],
    ["3. Required columns: " + IMPORT_TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.header).join(", ") + "."],
    ["4. Dates: use YYYY-MM-DD (e.g. 2024-01-15), DD-MM-YYYY, or DD-MMM-YYYY (e.g. 4-Feb-2017 or 4-Feb-17)."],
    ["5. Status: one of " + EMPLOYEE_STATUSES.join(", ") + ". Leave blank for new employees to default to ACTIVE."],
    ["6. Email uniquely identifies an employee — a row whose email already exists updates that employee instead of creating a duplicate."],
    ["7. Category (optional) must match an existing employee category name exactly; unknown categories are left blank."],
  ]);
  notesSheet.getColumn(1).width = 100;
  notesSheet.getColumn(1).alignment = { wrapText: true };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employee-import-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
