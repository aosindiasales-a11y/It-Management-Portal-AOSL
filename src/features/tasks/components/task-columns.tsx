"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Category, Tag, Task } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { TagList } from "@/features/tags/components/tag-list";
import { cn, daysUntil, formatDate } from "@/lib/utils";

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "bg-accent text-accent-foreground",
  HIGH: "bg-warning/15 text-warning",
  URGENT: "bg-destructive/15 text-destructive",
};

interface BuildColumnsArgs {
  categories: Category[];
  tagMap: Record<string, string[]>;
  allTags: Tag[];
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onToggleCompleted: (task: Task) => void;
  onArchive: (task: Task) => void;
  onRestore: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function buildTaskColumns({
  categories,
  tagMap,
  allTags,
  onEdit,
  onDuplicate,
  onToggleCompleted,
  onArchive,
  onRestore,
  onDelete,
}: BuildColumnsArgs): ColumnDef<Task, unknown>[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [
    {
      id: "title",
      accessorFn: (row) => row.title,
      header: "Task",
      cell: ({ row }) => {
        const overdue = !row.original.completed && (daysUntil(row.original.dueDate) ?? 0) < 0;
        return (
          <div className="flex items-start gap-2.5">
            <Checkbox
              checked={row.original.completed}
              onCheckedChange={() => onToggleCompleted(row.original)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-medium text-foreground", row.original.completed && "text-muted-foreground line-through")}>
                {row.original.title}
              </p>
              <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                {row.original.dueDate ? `Due ${formatDate(row.original.dueDate)}` : "No due date"}
                {overdue ? " · Overdue" : ""}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "priority",
      accessorFn: (row) => row.priority,
      header: "Priority",
      filterFn: multiSelectFilter,
      cell: ({ row }) => (
        <Badge className={cn("border-0 capitalize", PRIORITY_STYLES[row.original.priority])}>{row.original.priority.toLowerCase()}</Badge>
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
