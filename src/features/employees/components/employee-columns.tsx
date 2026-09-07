"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Employee, Tag } from "@prisma/client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { formatDate, getInitials } from "@/lib/utils";

const STATUS_STYLES: Record<Employee["status"], string> = {
  ACTIVE: "bg-success/15 text-success",
  ON_LEAVE: "bg-warning/15 text-warning",
  RESIGNED: "bg-muted text-muted-foreground",
  INACTIVE: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<Employee["status"], string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  RESIGNED: "Resigned",
  INACTIVE: "Inactive",
};

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  onEdit: (employee: Employee) => void;
  onDuplicate: (employee: Employee) => void;
  onArchive: (employee: Employee) => void;
  onRestore: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export function buildEmployeeColumns({
  categories,
  tagMap,
  allTags,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<Employee, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [
    {
      id: "employeeId",
      accessorFn: (row) => row.employeeId ?? "",
      header: "Employee ID",
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.employeeId || <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: "Employee",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "dateOfBirth",
      accessorFn: (row) => row.dateOfBirth,
      header: "Date of Birth",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.dateOfBirth)}</span>,
    },
    {
      id: "department",
      accessorFn: (row) => row.department,
      header: "Department",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <span className="text-sm text-foreground">{row.original.department}</span>,
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: "Status",
      filterFn: multiSelectFilter,
      cell: ({ row }) => (
        <Badge className={`border-0 ${STATUS_STYLES[row.original.status]}`}>{STATUS_LABELS[row.original.status]}</Badge>
      ),
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
      id: "tags",
      accessorFn: (row) => tagMap[row.id] ?? [],
      header: "Tags",
      filterFn: "arrIncludesSome",
      cell: ({ row }) => {
        const ids = tagMap[row.original.id] ?? [];
        const tags = allTags.filter((t) => ids.includes(t.id));
        return <TagList tags={tags} />;
      },
    },
    {
      id: "joiningDate",
      accessorFn: (row) => row.joiningDate,
      header: "Joined",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.joiningDate)}</span>,
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
