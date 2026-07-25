"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { taskSchema, type TaskFormValues } from "@/features/tasks/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "tasks" as const;

export async function getTasks(includeArchived = false) {
  return prisma.task.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

function toData(parsed: TaskFormValues, customFields: Record<string, unknown>) {
  return {
    title: parsed.title,
    description: parsed.description || null,
    priority: parsed.priority,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
    reminderAt: parsed.reminderAt ? new Date(parsed.reminderAt) : null,
    categoryId: parsed.categoryId || null,
    customFields: serializeJsonValue(customFields),
  };
}

export async function createTask(input: TaskFormValues) {
  await requireAdmin();
  const parsed = taskSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const task = await prisma.task.create({ data: toData(parsed, customFields) });
  await setRecordTags({ module: MODULE, recordId: task.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: task.id, label: task.title, description: `Created task ${task.title}` });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return task;
}

export async function updateTask(id: string, input: TaskFormValues) {
  await requireAdmin();
  const parsed = taskSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...toData(parsed, customFields),
      completed: parsed.completed,
      completedAt: parsed.completed ? new Date() : null,
    },
  });

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: task.title, description: `Updated task ${task.title}` });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return task;
}

export async function toggleTaskCompleted(id: string) {
  await requireAdmin();
  const existing = await prisma.task.findUniqueOrThrow({ where: { id } });
  const completed = !existing.completed;
  const task = await prisma.task.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  });
  await logActivity({
    action: "updated",
    module: MODULE,
    recordId: id,
    label: task.title,
    description: completed ? `Completed task ${task.title}` : `Reopened task ${task.title}`,
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return task;
}

export async function archiveTask(id: string) {
  await requireAdmin();
  const task = await prisma.task.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: task.title, description: `Archived task ${task.title}` });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function restoreTask(id: string) {
  await requireAdmin();
  const task = await prisma.task.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: task.title, description: `Restored task ${task.title}` });
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  await requireAdmin();
  const task = await prisma.task.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: task.title, description: `Deleted task ${task.title}` });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function duplicateTask(id: string) {
  await requireAdmin();
  const original = await prisma.task.findUniqueOrThrow({ where: { id } });

  const copy = await prisma.task.create({
    data: {
      title: `${original.title} (Copy)`,
      description: original.description,
      priority: original.priority,
      dueDate: original.dueDate,
      reminderAt: original.reminderAt,
      categoryId: original.categoryId,
      completed: false,
      customFields: original.customFields ?? undefined,
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.title, description: `Duplicated task ${original.title}` });

  revalidatePath("/tasks");
  return copy;
}

export async function getTaskTagIds(id: string) {
  return getRecordTagIds(MODULE, id);
}
