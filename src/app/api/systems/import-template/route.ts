import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { getCurrentAdmin } from "@/lib/auth/dal";
import { SYSTEM_STATUSES } from "@/features/systems/schema";
import { IMPORT_TEMPLATE_COLUMNS, TEMPLATE_SAMPLE_ASSET_CODE, type ImportField } from "@/features/systems/import/constants";

const SAMPLE_ROW_VALUES: Record<ImportField, string> = {
  systemName: "Dell (Laptop)",
  allocatedPersonName: "Jane Doe",
  assetCode: TEMPLATE_SAMPLE_ASSET_CODE,
  keyboard: "Yes",
  mousePad: "Yes",
  charger: "Yes",
  status: "",
};

/** The downloadable "Import Assets" template — mirrors src/app/api/employees/import-template for binary file streaming outside the server-action CRUD path. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Assets");

  const headers = IMPORT_TEMPLATE_COLUMNS.map((c) => c.header);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  sheet.addRow(IMPORT_TEMPLATE_COLUMNS.map((c) => SAMPLE_ROW_VALUES[c.field]));
  sheet.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };

  sheet.columns.forEach((column) => {
    column.width = 24;
  });

  const notesSheet = workbook.addWorksheet("Instructions");
  notesSheet.addRow(["How to use this template"]);
  notesSheet.getRow(1).font = { bold: true, size: 13 };
  notesSheet.addRows([
    [""],
    ["1. Fill in one row per asset on the \"Assets\" sheet. Keep the header row as-is."],
    ["2. Row 2 is example data — it's recognized automatically and never imported, even if you forget to delete it."],
    ["3. Required columns: " + IMPORT_TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.header).join(", ") + "."],
    ["4. Asset Code uniquely identifies an asset — a row whose Asset Code already exists updates that asset instead of creating a duplicate."],
    ["5. Allocated Person Name must match an existing Employee's full name exactly. Leave it blank to mark the asset vacant — blank does NOT mean \"no change\", it means vacant."],
    ["6. Keyboard / Mouse/Mouse Pad / Charger: use Yes, No, or leave blank. Blank means \"not specified\" — it is never treated as No."],
    ["7. Status: one of " + SYSTEM_STATUSES.join(", ") + ". Leave blank to default to ALLOCATED (if Allocated Person Name is filled in) or VACANT (if it's blank)."],
    ["8. Passwords are never imported here — link a Credential Vault entry to an asset from the Systems page after importing."],
  ]);
  notesSheet.getColumn(1).width = 100;
  notesSheet.getColumn(1).alignment = { wrapText: true };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="systems-import-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
