"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Tags as TagsIcon, Trash2 } from "lucide-react";
import type { Tag } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SWATCHES } from "@/lib/colors";
import { createTag, deleteTag, updateTag } from "@/features/tags/actions";

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Tag | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tags are shared across every module. {tags.length} tag{tags.length === 1 ? "" : "s"} total.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <EmptyState icon={TagsIcon} title="No tags yet" description="Create tags like Urgent, Production, or Critical to filter records across the whole app." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag.id} className="group flex items-center gap-1.5 rounded-full border border-border py-1 pl-3 pr-1.5 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
              <button
                onClick={() => setDeleteTarget(tag)}
                className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label={`Delete ${tag.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <AddTagDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => router.refresh()} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This removes the tag from every record it's applied to."
        confirmLabel="Delete tag"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteTag(deleteTarget.id);
          toast.success(`Deleted tag "${deleteTarget.name}"`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddTagDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(SWATCHES[0]!);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const tag = await createTag({ name: name.trim(), color });
      await updateTag({ id: tag.id, color });
      toast.success(`Added tag "${name.trim()}"`);
      setName("");
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Couldn't add that tag.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add tag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="e.g. Urgent, Production, HR" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className="h-7 w-7 rounded-full transition-all"
                style={{ backgroundColor: swatch, boxShadow: color === swatch ? `0 0 0 2px ${swatch}` : "none" }}
                aria-label={swatch}
              />
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Add tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
