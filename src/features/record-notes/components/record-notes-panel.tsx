"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, Pencil, StickyNote, Trash2 } from "lucide-react";
import type { RecordNote } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { addRecordNote, deleteRecordNote, updateRecordNote } from "@/features/record-notes/actions";
import type { ModuleKey } from "@/config/modules";

interface RecordNotesPanelProps {
  module: ModuleKey;
  recordId: string;
  notes: RecordNote[];
  onChanged?: () => void;
}

export function RecordNotesPanel({ module, recordId, notes, onChanged }: RecordNotesPanelProps) {
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<RecordNote | null>(null);

  async function handleAdd() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await addRecordNote({ module, recordId, content: draft.trim() });
      setDraft("");
      onChanged?.();
    } catch {
      toast.error("Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editValue.trim()) return;
    await updateRecordNote(id, editValue.trim());
    setEditingId(null);
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Write a private note… (only you can see this)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={saving || !draft.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No private notes" description="Jot down anything worth remembering about this record." />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-border p-3">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} autoFocus />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(note.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditValue(note.content);
                        }}
                        aria-label="Edit note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(note)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this note?"
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecordNote(deleteTarget.id);
          setDeleteTarget(null);
          onChanged?.();
        }}
      />
    </div>
  );
}
