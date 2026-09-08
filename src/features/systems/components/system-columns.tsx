"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Employee, System, Tag } from "@prisma/client";
import { KeyRound, ShieldAlert, UserCog, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { daysUntil, formatDate } from "@/lib/utils";
import type { SafeCredential } from "@/features/systems/types";

const STATUS_STYLES: Record<System["status"], string> = {
  ALLOCATED: "bg-success/15 text-success",
  VACANT: "bg-secondary text-secondary-foreground",
  REPAIR: "bg-warning/15 text-warning",
  RETIRED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<System["status"], string> = {
  ALLOCATED: "Allocated",
  VACANT: "Vacant",
  REPAIR: "Repair",
  RETIRED: "Retired",
};

function YesNoCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className={value === "Yes" ? "text-foreground" : "text-muted-foreground"}>{value}</span>;
}

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  employees: Employee[];
  credentials: SafeCredential[];
  onEdit: (system: System) => void;
  onDuplicate: (system: System) => void;
  onArchive: (system: System) => void;
  onRestore: (system: System) => void;
  onDelete: (system: System) => void;
  onAssign: (system: System) => void;
  onMarkVacant: (system: System) => void;
  onViewCredential: (system: System) => void;
}

export function buildSystemColumns({
  categories,
  tagMap,
  allTags,
  employees,
  credentials,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onAssign,
  onMarkVacant,
  onViewCredential,
}: BuildColumnsArgs): ColumnDef<System, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const credentialById = new Map(credentials.map((c) => [c.id, c]));

  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: "System Name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.original.name}</p>
          {row.original.assetType && <p className="truncate text-xs text-muted-foreground">{row.original.assetType}</p>}
        </div>
      ),
    },
    {
      id: "assignedTo",
      accessorFn: (row) => row.assignedEmployeeId ?? "",
      header: "Allocated To",
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const employee = row.original.assignedEmployeeId ? employeeById.get(row.original.assignedEmployeeId) : null;
        return <span className="text-sm text-foreground">{employee?.name ?? <span className="text-muted-foreground">Unassigned</span>}</span>;
      },
    },
    {
      id: "assetId",
      accessorFn: (row) => row.assetId,
      header: "Asset Code",
      cell: ({ row }) => <span className="whitespace-nowrap text-sm text-foreground">{row.original.assetId}</span>,
    },
    {
      id: "keyboard",
      accessorFn: (row) => row.keyboard ?? "",
      header: "Keyboard",
      cell: ({ row }) => <YesNoCell value={row.original.keyboard} />,
    },
    {
      id: "mousePad",
      accessorFn: (row) => row.mousePad ?? "",
      header: "Mouse/Pad",
      cell: ({ row }) => <YesNoCell value={row.original.mousePad} />,
    },
    {
      id: "charger",
      accessorFn: (row) => row.charger ?? "",
      header: "Charger",
      cell: ({ row }) => <YesNoCell value={row.original.charger} />,
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: "Status",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <Badge className={`border-0 ${STATUS_STYLES[row.original.status]}`}>{STATUS_LABELS[row.original.status]}</Badge>,
    },
    {
      id: "assetType",
      accessorFn: (row) => row.assetType ?? "",
      header: "Type",
      filterFn: multiSelectFilter,
      cell: ({ row }) => row.original.assetType ?? <span className="text-muted-foreground">—</span>,
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
      cell: ({ row }) => {
        const system = row.original;
        const hasCredential = !!system.credentialId && credentialById.has(system.credentialId);
        return (
          <div className="flex justify-end">
            <RowActionsMenu
              onEdit={() => onEdit(system)}
              onDuplicate={() => onDuplicate(system)}
              onArchive={!system.archivedAt ? () => onArchive(system) : undefined}
              onRestore={system.archivedAt ? () => onRestore(system) : undefined}
              onDelete={() => onDelete(system)}
              archived={!!system.archivedAt}
              extraItems={
                <>
                  <DropdownMenuItem onSelect={() => onAssign(system)}>
                    <UserCog />
                    {system.assignedEmployeeId ? "Reassign" : "Assign"}
                  </DropdownMenuItem>
                  {system.assignedEmployeeId && (
                    <DropdownMenuItem onSelect={() => onMarkVacant(system)}>
                      <UserX />
                      Mark Vacant
                    </DropdownMenuItem>
                  )}
                  {hasCredential && (
                    <DropdownMenuItem onSelect={() => onViewCredential(system)}>
                      <KeyRound />
                      View Credential
                    </DropdownMenuItem>
                  )}
                </>
              }
            />
          </div>
        );
      },
    },
  ];
}
