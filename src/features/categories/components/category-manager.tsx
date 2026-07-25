"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import type { Category } from "@prisma/client";

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
import { createCategory, deleteCategory, updateCategory } from "@/features/categories/actions";
import type { ModuleKey } from "@/config/modules";

export function CategoryManager({ module, categories }: { module: ModuleKey; categories: Category[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length === 0 ? "No categories yet." : `${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No categories for this module"
          description="Create categories like Cloud, Security, or Office to group records the way you think about them."
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="group flex items-center gap-1.5 rounded-full border border-border py-1 pl-3 pr-1.5 text-sm"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
              <button
                onClick={() => setDeleteTarget(category)}
                className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label={`Delete ${category.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} module={module} onCreated={() => router.refresh()} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Records in this category keep their other data but lose the category assignment."
        confirmLabel="Delete category"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteCategory(deleteTarget.id);
          toast.success(`Deleted category "${deleteTarget.name}"`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddCategoryDialog({
  open,
  onOpenChange,
  module,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ModuleKey;
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
      const category = await createCategory({ module, name: name.trim(), color });
      await updateCategory({ id: category.id, color });
      toast.success(`Added category "${name.trim()}"`);
      setName("");
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Couldn't add that category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="e.g. Cloud, Security, Office"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className="h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-all"
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
              Add category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
