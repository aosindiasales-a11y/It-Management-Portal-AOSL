"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { noteSchema, type NoteFormValues } from "@/features/notes/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "notes" as const;

export async function getNotes(includeArchived = false) {
  return prisma.note.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

function toData(parsed: NoteFormValues, customFields: Record<string, unknown>) {
  return {
    title: parsed.title,
    content: parsed.content || "",
    categoryId: parsed.categoryId || null,
    pinned: parsed.pinned,
    customFields: serializeJsonValue(customFields),
  };
}

export async function createNote(input: NoteFormValues) {
  await requireAdmin();
  const parsed = noteSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const note = await prisma.note.create({ data: toData(parsed, customFields) });
  await setRecordTags({ module: MODULE, recordId: note.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: note.id, label: note.title, description: `Added note ${note.title}` });

  revalidatePath("/notes");
  revalidatePath("/dashboard");
  return note;
}

export async function updateNote(id: string, input: NoteFormValues) {
  await requireAdmin();
  const parsed = noteSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const note = await prisma.note.update({ where: { id }, data: toData(parsed, customFields) });
  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: note.title, description: `Updated note ${note.title}` });

  revalidatePath("/notes");
  return note;
}

export async function togglePinNote(id: string) {
  await requireAdmin();
  const existing = await prisma.note.findUniqueOrThrow({ where: { id } });
  const note = await prisma.note.update({ where: { id }, data: { pinned: !existing.pinned } });
  revalidatePath("/notes");
  return note;
}

export async function archiveNote(id: string) {
  await requireAdmin();
  const note = await prisma.note.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: note.title, description: `Archived note ${note.title}` });
  revalidatePath("/notes");
}

export async function restoreNote(id: string) {
  await requireAdmin();
  const note = await prisma.note.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: note.title, description: `Restored note ${note.title}` });
  revalidatePath("/notes");
}

export async function deleteNote(id: string) {
  await requireAdmin();
  const note = await prisma.note.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: note.title, description: `Deleted note ${note.title}` });
  revalidatePath("/notes");
}

export async function duplicateNote(id: string) {
  await requireAdmin();
  const original = await prisma.note.findUniqueOrThrow({ where: { id } });

  const copy = await prisma.note.create({
    data: {
      title: `${original.title} (Copy)`,
      content: original.content,
      categoryId: original.categoryId,
      pinned: false,
      customFields: original.customFields ?? undefined,
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.title, description: `Duplicated note ${original.title}` });

  revalidatePath("/notes");
  return copy;
}

export async function getNoteTagIds(id: string) {
  return getRecordTagIds(MODULE, id);
}
