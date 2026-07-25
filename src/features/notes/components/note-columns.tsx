"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Note, Tag } from "@prisma/client";
import { Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { cn, formatDate } from "@/lib/utils";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  onEdit: (note: Note) => void;
  onDuplicate: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onArchive: (note: Note) => void;
  onRestore: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function buildNoteColumns({
  categories,
  tagMap,
  allTags,
  onEdit,
  onDuplicate,
  onTogglePin,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<Note, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [
    {
      id: "title",
      accessorFn: (row) => row.title,
      header: "Note",
      cell: ({ row }) => {
        const preview = stripHtml(row.original.content);
        return (
          <div className="flex items-start gap-2 min-w-0">
            {row.original.pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current text-primary" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.original.title}</p>
              {preview && <p className="truncate text-xs text-muted-foreground">{preview}</p>}
            </div>
          </div>
        );
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
      id: "updatedAt",
      accessorFn: (row) => row.updatedAt,
      header: "Updated",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.updatedAt)}</span>,
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
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(row.original);
            }}
            aria-label={row.original.pinned ? "Unpin" : "Pin"}
          >
            <Pin className={cn("h-4 w-4", row.original.pinned && "fill-current text-primary")} />
          </Button>
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
