"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type Table,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableExportMenu } from "@/components/data-table/data-table-export-menu";
import type { ModuleKey } from "@/config/modules";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  onRowClick?: (row: TData) => void;
  toolbar?: (table: Table<TData>) => React.ReactNode;
  emptyState?: React.ReactNode;
  pageSize?: number;
  /** Columns hidden from the header/body by default but still filterable via toolbar facets — undefined shows every column, unchanged from before. */
  initialColumnVisibility?: VisibilityState;
  /** Title used by the built-in Export menu (file name, PDF/print heading). Omit to hide the Export menu entirely. */
  exportTitle?: string;
  /** Module key logged against exports from this table — omit for tables that aren't module-backed. */
  exportModuleKey?: ModuleKey | "Admin";
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Search…",
  onRowClick,
  toolbar,
  emptyState,
  pageSize = 20,
  initialColumnVisibility,
  exportTitle,
  exportModuleKey,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize }, columnVisibility: initialColumnVisibility },
  });

  const hasFilters = columnFilters.length > 0 || globalFilter.length > 0;
  const showEmptyState = data.length === 0 && emptyState;

  if (showEmptyState) return <>{emptyState}</>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {toolbar?.(table)}
        {exportTitle && <DataTableExportMenu table={table} title={exportTitle} moduleKey={exportModuleKey} />}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGlobalFilter("");
              setColumnFilters([]);
            }}
          >
            Reset
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && <ArrowUp className="h-3 w-3" />}
                        {header.column.getIsSorted() === "desc" && <ArrowDown className="h-3 w-3" />}
                        {!header.column.getIsSorted() && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No matching records.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-accent/40")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}
