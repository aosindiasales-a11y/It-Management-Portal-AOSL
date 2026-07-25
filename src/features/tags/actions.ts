"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { MODULE_KEYS, type ModuleKey } from "@/config/modules";

export async function getAllTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

/** Tag ids currently assigned to one record. */
export async function getRecordTagIds(module: ModuleKey, recordId: string): Promise<string[]> {
  const rows = await prisma.tagAssignment.findMany({
    where: { module, recordId },
    select: { tagId: true },
  });
  return rows.map((r) => r.tagId);
}

/** Tag assignments for every record in a module, grouped by recordId — for list pages. */
export async function getModuleTagMap(module: ModuleKey): Promise<Record<string, string[]>> {
  const rows = await prisma.tagAssignment.findMany({
    where: { module },
    include: { tag: true },
  });
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    (map[row.recordId] ??= []).push(row.tagId);
  }
  return map;
}

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: z.string().optional(),
});

export async function createTag(input: z.infer<typeof createTagSchema>) {
  await requireAdmin();
  const parsed = createTagSchema.parse(input);

  const existing = await prisma.tag.findUnique({ where: { name: parsed.name } });
  if (existing) return existing;

  return prisma.tag.create({ data: { name: parsed.name, color: parsed.color ?? "#6b7280" } });
}

export async function updateTag(input: { id: string; name?: string; color?: string }) {
  await requireAdmin();
  const tag = await prisma.tag.update({ where: { id: input.id }, data: { name: input.name, color: input.color } });
  revalidatePath("/settings");
  for (const m of MODULE_KEYS) revalidatePath(`/${m}`);
  return tag;
}

export async function deleteTag(id: string) {
  await requireAdmin();
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/settings");
  for (const m of MODULE_KEYS) revalidatePath(`/${m}`);
}

const setRecordTagsSchema = z.object({
  module: z.enum(MODULE_KEYS),
  recordId: z.string(),
  tagIds: z.array(z.string()),
});

/** Replaces all tag assignments for a record in one call — simplest mental model for a small tag list. */
export async function setRecordTags(input: z.infer<typeof setRecordTagsSchema>) {
  await requireAdmin();
  const { module, recordId, tagIds } = setRecordTagsSchema.parse(input);

  await prisma.$transaction([
    prisma.tagAssignment.deleteMany({ where: { module, recordId } }),
    ...tagIds.map((tagId) =>
      prisma.tagAssignment.create({ data: { module, recordId, tagId } })
    ),
  ]);

  revalidatePath(`/${module}`);
}

/** Copies tag assignments from one record to another — used by "Duplicate". */
export async function copyRecordTags(module: ModuleKey, fromRecordId: string, toRecordId: string) {
  const tagIds = await getRecordTagIds(module, fromRecordId);
  if (tagIds.length === 0) return;
  await prisma.tagAssignment.createMany({
    data: tagIds.map((tagId) => ({ module, recordId: toRecordId, tagId })),
  });
}
