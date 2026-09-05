"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { MODULE_KEYS, MODULES, type ModuleKey } from "@/config/modules";

export async function listRecordNotes(module: ModuleKey, recordId: string) {
  await requireAdmin();
  return prisma.recordNote.findMany({
    where: { module, recordId },
    orderBy: { createdAt: "desc" },
  });
}

const addNoteSchema = z.object({
  module: z.enum(MODULE_KEYS),
  recordId: z.string(),
  content: z.string().trim().min(1).max(4000),
});

export async function addRecordNote(input: z.infer<typeof addNoteSchema>) {
  await requireAdmin();
  const parsed = addNoteSchema.parse(input);
  const note = await prisma.recordNote.create({ data: parsed });
  revalidatePath(MODULES[parsed.module].href);
  return note;
}

export async function updateRecordNote(id: string, content: string) {
  await requireAdmin();
  const note = await prisma.recordNote.update({
    where: { id },
    data: { content: content.trim() },
  });
  revalidatePath(MODULES[note.module as ModuleKey]?.href ?? "/dashboard");
  return note;
}

export async function deleteRecordNote(id: string) {
  await requireAdmin();
  const note = await prisma.recordNote.delete({ where: { id } });
  revalidatePath(MODULES[note.module as ModuleKey]?.href ?? "/dashboard");
}
