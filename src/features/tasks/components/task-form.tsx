"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Category, Tag, Task } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { taskSchema, TASK_DEFAULTS, TASK_PRIORITIES, type TaskFormValues } from "@/features/tasks/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createTask, updateTask } from "@/features/tasks/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

const PRIORITY_LABELS: Record<(typeof TASK_PRIORITIES)[number], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

interface TaskFormProps {
  task?: Task | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

function toDateTimeInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 16) : "";
}

export function TaskForm({ task, initialTagIds = [], categories, allTags, customFieldDefs, onSuccess }: TaskFormProps) {
  const isEditing = !!task;
  const draft = useDraft<TaskFormValues>(`tasks:${task?.id ?? "new"}`);

  const defaultValues: TaskFormValues = task
    ? {
        title: task.title,
        description: task.description ?? "",
        priority: task.priority as TaskFormValues["priority"],
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
        reminderAt: toDateTimeInput(task.reminderAt),
        categoryId: task.categoryId,
        completed: task.completed,
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(task.customFields),
      }
    : draft.readDraft() ?? TASK_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: TaskFormValues) {
    try {
      if (isEditing) {
        await updateTask(task.id, values);
        toast.success("Task updated");
      } else {
        await createTask(values);
        toast.success("Task created");
        draft.clearDraft();
      }
      onSuccess();
    } catch {
      toast.error("Couldn't save this task. Try again.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");
  const priority = watch("priority");
  const completed = watch("completed");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} placeholder="Renew Microsoft 365 license" autoFocus />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={(v) => setValue("priority", v as TaskFormValues["priority"])}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" type="date" {...register("dueDate")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="reminderAt">Reminder</Label>
          <Input id="reminderAt" type="datetime-local" {...register("reminderAt")} />
        </div>
      </div>

      {isEditing && (
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={completed} onCheckedChange={(c) => setValue("completed", c === true)} />
          <span className="text-sm text-foreground">Mark as completed</span>
        </label>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="tasks" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
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
          {isEditing ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
