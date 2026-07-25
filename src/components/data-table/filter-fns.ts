import type { Row, RowData } from "@tanstack/react-table";

/**
 * Matches a single-value column (department, status, category id, …)
 * against an array of selected values from a DataTableFacetFilter.
 * TanStack's built-in `arrIncludesSome` assumes the row's own value is an
 * array (e.g. tag ids); this is the mirror image for plain-value columns.
 */
export function multiSelectFilter<TData extends RowData>(row: Row<TData>, columnId: string, filterValue: string[]) {
  if (!filterValue || filterValue.length === 0) return true;
  const value = row.getValue(columnId);
  return filterValue.includes(String(value));
}
