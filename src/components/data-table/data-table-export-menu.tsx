"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportTableToExcel, exportTableToPdf, printTable } from "@/lib/export/table-export";
import { logExportEvent } from "@/features/activity/actions";
import type { ModuleKey } from "@/config/modules";

interface DataTableExportMenuProps<TData> {
  table: Table<TData>;
  /** Human title used for the file name, PDF/print heading and the audit log entry, e.g. "Employees". */
  title: string;
  /** Module key for the audit trail — omit only for tables that aren't module-backed. */
  moduleKey?: ModuleKey | "Admin";
}

/** Export/Print dropdown built into every DataTable — Excel and PDF respect the table's current search/filter state. */
export function DataTableExportMenu<TData>({ table, title, moduleKey }: DataTableExportMenuProps<TData>) {
  const [pending, setPending] = React.useState<"excel" | "pdf" | null>(null);

  async function handleExcel() {
    setPending("excel");
    try {
      const count = await exportTableToExcel(table, title);
      if (moduleKey) await logExportEvent(moduleKey, title, "Excel", count);
      toast.success(`Exported ${count} record${count === 1 ? "" : "s"} to Excel`);
    } catch {
      toast.error("Excel export failed.");
    } finally {
      setPending(null);
    }
  }

  async function handlePdf() {
    setPending("pdf");
    try {
      const count = await exportTableToPdf(table, title);
      if (moduleKey) await logExportEvent(moduleKey, title, "PDF", count);
      toast.success(`Exported ${count} record${count === 1 ? "" : "s"} to PDF`);
    } catch {
      toast.error("PDF export failed.");
    } finally {
      setPending(null);
    }
  }

  function handlePrint() {
    printTable(table, title);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" disabled={pending !== null}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleExcel}>
          <FileSpreadsheet />
          Export Excel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handlePdf}>
          <FileText />
          Export PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handlePrint}>
          <Printer />
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
