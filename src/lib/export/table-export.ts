import type { Table } from "@tanstack/react-table";

/**
 * Generic export for any DataTable: reads the currently visible, currently
 * filtered rows/columns straight off the TanStack table instance, so Excel/
 * PDF/Print always match exactly what the admin is looking at on screen.
 * Columns are excluded by convention — an empty string header (the "actions"
 * column in every module) or an explicit `meta.excludeFromExport`.
 */
function extractExportRows<TData>(table: Table<TData>): { headers: string[]; rows: string[][] } {
  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => {
      const header = column.columnDef.header;
      const meta = column.columnDef.meta as { excludeFromExport?: boolean } | undefined;
      if (meta?.excludeFromExport) return false;
      if (typeof header !== "string" || header.trim() === "") return false;
      return true;
    });

  const headers = columns.map((column) => column.columnDef.header as string);
  const rows = table.getFilteredRowModel().rows.map((row) =>
    columns.map((column) => formatExportValue(row.getValue(column.id)))
  );

  return { headers, rows };
}

function formatExportValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map((v) => formatExportValue(v)).join(", ") : "—";
  return String(value);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFileName(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "export";
}

export async function exportTableToExcel<TData>(table: Table<TData>, title: string): Promise<number> {
  const { headers, rows } = extractExportRows(table);
  const ExcelJS = (await import("exceljs")).default;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31) || "Export");

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const length = String(cell.value ?? "").length;
      if (length > maxLength) maxLength = length;
    });
    column.width = Math.min(maxLength + 2, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeFileName(title)}.xlsx`);
  return rows.length;
}

export async function exportTableToPdf<TData>(table: Table<TData>, title: string): Promise<number> {
  const { headers, rows } = extractExportRows(table);
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const orientation = headers.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation });

  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())} · ${rows.length} record${rows.length === 1 ? "" : "s"}`, 14, 22);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${safeFileName(title)}.pdf`);
  return rows.length;
}

export function printTable<TData>(table: Table<TData>, title: string): number {
  const { headers, rows } = extractExportRows(table);
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return rows.length;

  const style = `
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    p.meta { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    @media print { body { padding: 0; } }
  `;
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
    <!doctype html>
    <html>
      <head><title>${escapeHtml(title)}</title><style>${style}</style></head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Printed ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())} · ${rows.length} record${rows.length === 1 ? "" : "s"}</p>
        <table>
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </body>
    </html>
  `;

  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();

  return rows.length;
}
