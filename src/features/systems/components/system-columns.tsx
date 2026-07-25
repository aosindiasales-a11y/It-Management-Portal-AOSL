"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Employee, System, Tag } from "@prisma/client";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { daysUntil, formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<System["status"], string> = {
  ACTIVE: "bg-success/15 text-success",
  IN_REPAIR: "bg-warning/15 text-warning",
  SPARE: "bg-secondary text-secondary-foreground",
  RETIRED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<System["status"], string> = {
  ACTIVE: "Active",
  IN_REPAIR: "In repair",
  SPARE: "Spare",
  RETIRED: "Retired",
};

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  employees: Employee[];
  onEdit: (system: System) => void;
  onDuplicate: (system: System) => void;
  onArchive: (system: System) => void;
  onRestore: (system: System) => void;
  onDelete: (system: System) => void;
}

export function buildSystemColumns({
  categories,
  tagMap,
  allTags,
  employees,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<System, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: "System",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.assetId}</p>
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: "Status",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <Badge className={`border-0 ${STATUS_STYLES[row.original.status]}`}>{STATUS_LABELS[row.original.status]}</Badge>,
    },
    {
      id: "assignedTo",
      accessorFn: (row) => row.assignedEmployeeId ?? "",
      header: "Assigned to",
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const employee = row.original.assignedEmployeeId ? employeeById.get(row.original.assignedEmployeeId) : null;
        return <span className="text-sm text-foreground">{employee?.name ?? <span className="text-muted-foreground">Unassigned</span>}</span>;
      },
    },
    {
      id: "category",
      accessorFn: (row) => row.categoryId ?? "",
      header: "Category",
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const category = row.original.categoryId ? categoryById.get(row.original.categoryId) : null;
        if (!category) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
            {category.name}
          </span>
        );
      },
    },
    {
      id: "warrantyExpiry",
      accessorFn: (row) => row.warrantyExpiry,
      header: "Warranty",
      cell: ({ row }) => {
        const days = daysUntil(row.original.warrantyExpiry);
        if (days === null) return <span className="text-muted-foreground">—</span>;
        const expiring = days <= 30;
        return (
          <span className={`flex items-center gap-1 text-sm ${expiring ? "text-warning" : "text-muted-foreground"}`}>
            {expiring && <ShieldAlert className="h-3.5 w-3.5" />}
            {formatDate(row.original.warrantyExpiry)}
          </span>
        );
      },
    },
    {
      id: "tags",
      accessorFn: (row) => tagMap[row.id] ?? [],
      header: "Tags",
      filterFn: "arrIncludesSome",
      cell: ({ row }) => {
        const ids = tagMap[row.original.id] ?? [];
        return <TagList tags={allTags.filter((t) => ids.includes(t.id))} />;
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RowActionsMenu
            onEdit={() => onEdit(row.original)}
            onDuplicate={() => onDuplicate(row.original)}
            onArchive={!row.original.archivedAt ? () => onArchive(row.original) : undefined}
            onRestore={row.original.archivedAt ? () => onRestore(row.original) : undefined}
            onDelete={() => onDelete(row.original)}
            archived={!!row.original.archivedAt}
          />
        </div>
      ),
    },
  ];
}
