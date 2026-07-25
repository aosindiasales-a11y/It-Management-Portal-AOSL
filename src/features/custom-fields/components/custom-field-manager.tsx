"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPES_WITH_OPTIONS,
  CUSTOM_FIELD_TYPE_LABELS,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields/types";
import {
  createCustomField,
  deleteCustomField,
  reorderCustomFields,
  updateCustomField,
} from "@/features/custom-fields/actions";
import type { ModuleKey } from "@/config/modules";

export function CustomFieldManager({ module, defs }: { module: ModuleKey; defs: CustomFieldDef[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CustomFieldDef | null>(null);
  const [pending, startTransition] = React.useTransition();

  function refresh() {
    router.refresh();
  }

  function toggleHidden(def: CustomFieldDef) {
    startTransition(async () => {
      await updateCustomField({ id: def.id, hidden: !def.hidden });
      toast.success(def.hidden ? `${def.label} is now visible` : `${def.label} hidden`);
      refresh();
    });
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...defs];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    startTransition(async () => {
      await reorderCustomFields(module, next.map((d) => d.id));
      refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteCustomField(deleteTarget.id);
      toast.success(`Deleted field "${deleteTarget.label}"`);
      setDeleteTarget(null);
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {defs.length === 0 ? "No custom fields yet." : `${defs.length} custom field${defs.length === 1 ? "" : "s"}.`}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add field
        </Button>
      </div>

      {defs.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No custom fields for this module"
          description="Add fields like GPU, IP Address, or Purchase Vendor to capture whatever this module needs."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add your first field
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {defs.map((def, index) => (
            <li key={def.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{def.label}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {CUSTOM_FIELD_TYPE_LABELS[def.fieldType]}
                  </Badge>
                  {def.required && (
                    <Badge variant="secondary" className="text-[11px]">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">key: {def.key}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon" disabled={pending || index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending || index === defs.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={pending} onClick={() => toggleHidden(def)} aria-label={def.hidden ? "Show field" : "Hide field"}>
                  {def.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => setDeleteTarget(def)}
                  className="text-destructive hover:text-destructive"
                  aria-label="Delete field"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddFieldDialog open={addOpen} onOpenChange={setAddOpen} module={module} onCreated={refresh} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.label}"?`}
        description="Existing records keep their saved value, but the field disappears from every form. This can't be undone."
        confirmLabel="Delete field"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AddFieldDialog({
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
  const [label, setLabel] = React.useState("");
  const [fieldType, setFieldType] = React.useState<CustomFieldType>("TEXT");
  const [optionsText, setOptionsText] = React.useState("");
  const [required, setRequired] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const needsOptions = CUSTOM_FIELD_TYPES_WITH_OPTIONS.includes(fieldType);

  function reset() {
    setLabel("");
    setFieldType("TEXT");
    setOptionsText("");
    setRequired(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await createCustomField({
        module,
        label: label.trim(),
        fieldType,
        required,
        options: needsOptions
          ? optionsText
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
      });
      toast.success(`Added field "${label.trim()}"`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Couldn't add that field. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add custom field</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="field-label">Field label</Label>
            <Input
              id="field-label"
              placeholder="e.g. GPU, IP Address, Purchase Vendor"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-type">Field type</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CUSTOM_FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsOptions && (
            <div className="space-y-1.5">
              <Label htmlFor="field-options">Choices (comma separated)</Label>
              <Input
                id="field-options"
                placeholder="Option A, Option B, Option C"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={required} onCheckedChange={(c) => setRequired(c === true)} />
            <span className="text-sm text-muted-foreground">Make this field required</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !label.trim()}>
              Add field
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
