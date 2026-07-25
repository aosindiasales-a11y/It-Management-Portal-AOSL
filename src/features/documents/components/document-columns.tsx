"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Document as DocumentRecord, Tag } from "@prisma/client";
import { Download, File, FileImage, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { formatDate } from "@/lib/utils";

function iconFor(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  onEdit: (doc: DocumentRecord) => void;
  onDuplicate: (doc: DocumentRecord) => void;
  onArchive: (doc: DocumentRecord) => void;
  onRestore: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
}

export function buildDocumentColumns({
  categories,
  tagMap,
  allTags,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<DocumentRecord, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [
    {
      id: "title",
      accessorFn: (row) => row.title,
      header: "Document",
      cell: ({ row }) => {
        const Icon = iconFor(row.original.mimeType);
        return (
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.original.title}</p>
              <p className="truncate text-xs text-muted-foreground">{row.original.fileName}</p>
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
      id: "uploadedAt",
      accessorFn: (row) => row.uploadedAt,
      header: "Uploaded",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.uploadedAt)}</span>,
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
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
            <a href={`/api/files/${row.original.id}`} target="_blank" rel="noopener noreferrer" download={row.original.fileName} aria-label={`Download ${row.original.title}`}>
              <Download className="h-4 w-4" />
            </a>
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
