"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pin } from "lucide-react";
import type { Category, Note, Tag } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { noteSchema, NOTE_DEFAULTS, type NoteFormValues } from "@/features/notes/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createNote, updateNote } from "@/features/notes/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";
import { cn } from "@/lib/utils";

interface NoteFormProps {
  note?: Note | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

export function NoteForm({ note, initialTagIds = [], categories, allTags, customFieldDefs, onSuccess }: NoteFormProps) {
  const isEditing = !!note;
  const draft = useDraft<NoteFormValues>(`notes:${note?.id ?? "new"}`);

  const defaultValues: NoteFormValues = note
    ? {
        title: note.title,
        content: note.content,
        categoryId: note.categoryId,
        pinned: note.pinned,
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(note.customFields),
      }
    : draft.readDraft() ?? NOTE_DEFAULTS;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: NoteFormValues) {
    try {
      if (isEditing) {
        await updateNote(note.id, values);
        toast.success("Note updated");
      } else {
        await createNote(values);
        toast.success("Note added");
        draft.clearDraft();
      }
      onSuccess();
    } catch {
      toast.error("Couldn't save this note. Try again.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");
  const pinned = watch("pinned");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register("title")} placeholder="VPN Configuration Steps" autoFocus />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setValue("pinned", !pinned)}
          className={cn(pinned && "border-primary text-primary")}
          aria-label={pinned ? "Unpin note" : "Pin note"}
          title={pinned ? "Unpin" : "Pin to top"}
        >
          <Pin className={cn("h-4 w-4", pinned && "fill-current")} />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Content</Label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => <RichTextEditor value={field.value ?? ""} onChange={field.onChange} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="notes" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker allTags={allTags} value={tagIds} onChange={(v) => setValue("tagIds", v)} />
        </div>
      </div>

      {customFieldDefs.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom fields</p>
            <CustomFieldsSection
              defs={customFieldDefs}
              values={customFields}
              onChange={(key, value) => setValue("customFields", { ...customFields, [key]: value })}
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Save changes" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
