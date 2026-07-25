"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import type { Category, Tag, Task } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildTaskColumns } from "@/features/tasks/components/task-columns";
import { TaskForm } from "@/features/tasks/components/task-form";
import { archiveTask, deleteTask, duplicateTask, getTaskTagIds, restoreTask, toggleTaskCompleted } from "@/features/tasks/actions";
import { TASK_PRIORITIES } from "@/features/tasks/schema";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface TasksViewProps {
  tasks: Task[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function TasksView({ tasks, categories, allTags, tagMap, customFieldDefs }: TasksViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<Task | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [archiveTarget, setArchiveTarget] = React.useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Task | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = tasks.find((t) => t.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(task: Task) {
    setActive(task);
    setSheetMode("edit");
    setActiveTagIds(await getTaskTagIds(task.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/tasks");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = tasks.filter((t) => (showArchived || !t.archivedAt) && (showCompleted || !t.completed));

  const columns = React.useMemo(
    () =>
      buildTaskColumns({
        categories,
        tagMap,
        allTags,
        onEdit: openEdit,
        onDuplicate: async (task) => {
          await duplicateTask(task.id);
          toast.success(`Duplicated ${task.title}`);
          router.refresh();
        },
        onToggleCompleted: async (task) => {
          await toggleTaskCompleted(task.id);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (task) => {
          await restoreTask(task.id);
          toast.success(`Restored ${task.title}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tagMap, allTags]
  );

  const priorityOptions = TASK_PRIORITIES.map((p) => ({ label: p.charAt(0) + p.slice(1).toLowerCase(), value: p }));
  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id, color: c.color }));
  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.id, color: t.color }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">A todo list with priority, due dates and reminders.</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
            <Label className="cursor-pointer font-normal">Show completed</Label>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            <Label className="cursor-pointer font-normal">Show archived</Label>
          </label>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks yet" description="Create your first task to start tracking what needs to get done." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search tasks…"
          onRowClick={openEdit}
          exportTitle="Tasks"
          exportModuleKey="tasks"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("priority")} title="Priority" options={priorityOptions} />
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Task" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit task" : "Create task"}
        module="tasks"
        recordId={active?.id}
      >
        <TaskForm
          task={active}
          initialTagIds={activeTagIds}
          categories={categories}
          allTags={allTags}
          customFieldDefs={customFieldDefs}
          onSuccess={() => {
            closeSheet();
            router.refresh();
          }}
        />
      </RecordSheet>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.title}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveTask(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.title}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.title}?`}
        description="This permanently deletes the task and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteTask(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.title}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
