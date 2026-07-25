"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, NetworkConfig, Tag } from "@prisma/client";

import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { revealWifiPassword } from "@/features/network/actions";

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  onEdit: (config: NetworkConfig) => void;
  onDuplicate: (config: NetworkConfig) => void;
  onArchive: (config: NetworkConfig) => void;
  onRestore: (config: NetworkConfig) => void;
  onDelete: (config: NetworkConfig) => void;
}

export function buildNetworkColumns({
  categories,
  tagMap,
  allTags,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<NetworkConfig, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [
    {
      id: "label",
      accessorFn: (row) => row.label,
      header: "Network",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.original.label}</p>
          {row.original.wifiName && <p className="truncate text-xs text-muted-foreground">{row.original.wifiName}</p>}
        </div>
      ),
    },
    {
      id: "wifiPassword",
      header: "WiFi password",
      enableSorting: false,
      cell: ({ row }) => <RevealableSecret onReveal={() => revealWifiPassword(row.original.id)} />,
    },
    {
      id: "isp",
      accessorFn: (row) => row.isp ?? "",
      header: "ISP",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.isp || "—"}</span>,
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
