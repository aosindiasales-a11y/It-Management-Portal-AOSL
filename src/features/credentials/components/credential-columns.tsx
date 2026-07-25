"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Credential, Tag } from "@prisma/client";
import { ExternalLink } from "lucide-react";

import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { revealCredentialPassword } from "@/features/credentials/actions";

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  onEdit: (credential: Credential) => void;
  onDuplicate: (credential: Credential) => void;
  onArchive: (credential: Credential) => void;
  onRestore: (credential: Credential) => void;
  onDelete: (credential: Credential) => void;
}

export function buildCredentialColumns({
  categories,
  tagMap,
  allTags,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<Credential, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [
    {
      id: "platform",
      accessorFn: (row) => row.platform,
      header: "Platform",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{row.original.platform}</span>
          {row.original.url && (
            <a
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ),
    },
    {
      id: "username",
      accessorFn: (row) => row.username ?? "",
      header: "Username",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.username || "—"}</span>,
    },
    {
      id: "password",
      header: "Password",
      enableSorting: false,
      cell: ({ row }) => <RevealableSecret onReveal={() => revealCredentialPassword(row.original.id)} />,
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
