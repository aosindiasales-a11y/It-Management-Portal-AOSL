"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { previewEmployeeImport, confirmEmployeeImport } from "@/features/employees/import/actions";
import { ACCEPTED_IMPORT_EXTENSIONS, MAX_IMPORT_FILE_SIZE_MB } from "@/features/employees/import/constants";
import type { ImportPreviewResult, ImportResult, ImportRow, ImportRowAction } from "@/features/employees/import/types";

interface ImportEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful (even partial) import so the caller can refresh the employees list. */
  onImported: () => void;
}

type Step = "upload" | "preview" | "result";

const PAGE_SIZE = 25;

const ACTION_BADGE: Record<ImportRowAction, { label: string; variant: "success" | "default" | "destructive" | "warning" | "outline" }> = {
  NEW: { label: "New", variant: "success" },
  UPDATE: { label: "Update", variant: "default" },
  INVALID: { label: "Invalid", variant: "destructive" },
  DUPLICATE: { label: "Duplicate", variant: "warning" },
  SAMPLE: { label: "Sample (skipped)", variant: "outline" },
};

function StatTile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" | "destructive" }) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className={cn("text-xl font-semibold tracking-tight", toneClass)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
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

async function downloadErrorReport(result: ImportResult): Promise<void> {
  if (result.failures.length === 0) return;
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Errors");

  sheet.addRow(["Row", "Name", "Email", "Department", "Error"]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  result.failures.forEach((failure) => {
    sheet.addRow([failure.rowNumber, failure.input.name || "—", failure.input.email || "—", failure.input.department || "—", failure.error ?? ""]);
  });
  sheet.columns.forEach((column) => {
    column.width = 24;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `employee-import-errors-${result.fileName.replace(/\.[^.]+$/, "")}.xlsx`
  );
}

export function ImportEmployeesDialog({ open, onOpenChange, onImported }: ImportEmployeesDialogProps) {
  const [step, setStep] = React.useState<Step>("upload");
  const [dragOver, setDragOver] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [preview, setPreview] = React.useState<ImportPreviewResult | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [page, setPage] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const busy = analyzing || importing;

  function reset() {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setPage(0);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return; // don't let a background upload/import get orphaned
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;

    const extension = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPTED_IMPORT_EXTENSIONS.includes(extension)) {
      toast.error("Unsupported file type. Upload a .xlsx, .xls or .csv file.");
      return;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`${file.name} is larger than ${MAX_IMPORT_FILE_SIZE_MB} MB.`);
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await previewEmployeeImport(formData);
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setPreview(response.data);
      setPage(0);
      setStep("preview");
    } catch {
      toast.error("Couldn't read this file. Try again.");
    } finally {
      setAnalyzing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const response = await confirmEmployeeImport(
        preview.fileName,
        preview.rows.map((row) => ({ rowNumber: row.rowNumber, input: row.input }))
      );
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
      setStep("result");
      onImported();
    } catch {
      toast.error("The import couldn't be completed. Try again.");
    } finally {
      setImporting(false);
    }
  }

  const importableCount = preview ? preview.summary.newCount + preview.summary.updateCount : 0;
  const pageRows: ImportRow[] = preview ? preview.rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : [];
  const pageCount = preview ? Math.max(1, Math.ceil(preview.rows.length / PAGE_SIZE)) : 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Employees"}
            {step === "preview" && "Import Preview"}
            {step === "result" && "Employee Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload an Excel file containing employee records to import multiple employees at once."}
            {step === "preview" && `${preview?.fileName} — review before confirming.`}
            {step === "result" && `Results for ${result?.fileName}`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 overflow-y-auto">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/employees/import-template">
                  <Download className="h-3.5 w-3.5" />
                  Download Excel Template
                </a>
              </Button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!busy) void handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !busy && inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                busy && "pointer-events-none opacity-70",
                dragOver ? "border-primary bg-accent/60" : "border-border hover:bg-accent/40"
              )}
            >
              {analyzing ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="text-sm font-medium text-foreground">
                {analyzing ? "Reading and validating your file…" : "Drag & drop your Excel file here"}
              </p>
              <p className="text-xs text-muted-foreground">or click to choose a file — up to {MAX_IMPORT_FILE_SIZE_MB} MB</p>
              <Button type="button" variant="secondary" size="sm" className="mt-1" disabled={busy}>
                Choose Excel File
              </Button>
              <p className="text-xs text-muted-foreground">XLSX · XLS · CSV</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatTile label="Total Rows" value={preview.summary.total} />
              <StatTile label="New" value={preview.summary.newCount} tone="success" />
              <StatTile label="Updates" value={preview.summary.updateCount} />
              <StatTile label="Invalid" value={preview.summary.invalidCount} tone="destructive" />
              <StatTile label="Duplicate" value={preview.summary.duplicateCount} tone="warning" />
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-secondary/95 backdrop-blur">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Row</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Department</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Action</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                      <td className="max-w-[160px] truncate px-3 py-2">{row.input.name || "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2">{row.input.email || "—"}</td>
                      <td className="max-w-[140px] truncate px-3 py-2">{row.input.department || "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={ACTION_BADGE[row.action].variant}>{ACTION_BADGE[row.action].label}</Badge>
                      </td>
                      <td className="max-w-[280px] px-3 py-2 text-xs text-muted-foreground">
                        {[...row.errors, ...row.warnings].join("; ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Rows {page * PAGE_SIZE + 1}–{Math.min(preview.rows.length, page * PAGE_SIZE + PAGE_SIZE)} of {preview.rows.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                    Previous
                  </Button>
                  <span className="px-2 text-xs">
                    Page {page + 1} of {pageCount}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
              {result.result === "SUCCESS" && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
              {result.result === "PARTIAL" && <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />}
              {result.result === "FAILED" && <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
              <p className="text-sm text-foreground">
                {result.result === "SUCCESS" && "Every valid row was imported successfully."}
                {result.result === "PARTIAL" && "Some rows were imported; others need attention."}
                {result.result === "FAILED" && "No rows could be imported."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatTile label="Total Rows" value={result.totalRows} />
              <StatTile label="Created" value={result.created} tone="success" />
              <StatTile label="Updated" value={result.updated} />
              <StatTile label="Skipped Invalid" value={result.skippedInvalid} tone="destructive" />
              <StatTile label="Skipped Duplicate" value={result.skippedDuplicate} tone="warning" />
            </div>
            {result.skippedSample > 0 && (
              <p className="text-xs text-muted-foreground">{result.skippedSample} sample template row(s) were skipped automatically.</p>
            )}
            {result.failed > 0 && (
              <p className="text-xs text-destructive">{result.failed} row(s) passed validation but failed to save — see the error report.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("upload")} disabled={importing}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmImport} disabled={importing || importableCount === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {importableCount} Employee{importableCount === 1 ? "" : "s"}
              </Button>
            </>
          )}

          {step === "result" && (
            <>
              {result && result.failures.length > 0 && (
                <Button type="button" variant="outline" onClick={() => void downloadErrorReport(result)}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download Error Report
                </Button>
              )}
              <Button type="button" onClick={() => handleOpenChange(false)}>
                View Employees
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
