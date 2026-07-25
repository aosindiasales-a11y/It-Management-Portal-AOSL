"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import type { Category, Note, Tag } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildNoteColumns } from "@/features/notes/components/note-columns";
import { NoteForm } from "@/features/notes/components/note-form";
import { archiveNote, deleteNote, duplicateNote, getNoteTagIds, restoreNote, togglePinNote } from "@/features/notes/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface NotesViewProps {
  notes: Note[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function NotesView({ notes, categories, allTags, tagMap, customFieldDefs }: NotesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<Note | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Note | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = notes.find((n) => n.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(note: Note) {
    setActive(note);
    setSheetMode("edit");
    setActiveTagIds(await getNoteTagIds(note.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/notes");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? notes : notes.filter((n) => !n.archivedAt);

  const columns = React.useMemo(
    () =>
      buildNoteColumns({
        categories,
        tagMap,
        allTags,
        onEdit: openEdit,
        onDuplicate: async (note) => {
          await duplicateNote(note.id);
          toast.success(`Duplicated ${note.title}`);
          router.refresh();
        },
        onTogglePin: async (note) => {
          await togglePinNote(note.id);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (note) => {
          await restoreNote(note.id);
          toast.success(`Restored ${note.title}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tagMap, allTags]
  );

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id, color: c.color }));
  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.id, color: t.color }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Procedures, configs and important contacts.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" description="Write down anything worth remembering — VPN steps, printer fixes, contacts." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search notes…"
          onRowClick={openEdit}
          exportTitle="Notes"
          exportModuleKey="notes"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Note" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit note" : "Add note"}
        module="notes"
        recordId={active?.id}
      >
        <NoteForm
          note={active}
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
          await archiveNote(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.title}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.title}?`}
        description="This permanently deletes the note and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteNote(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.title}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
