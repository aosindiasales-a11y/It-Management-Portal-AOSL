"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { clearCategoryFromModule } from "@/lib/module-tables";
import { MODULE_KEYS, type ModuleKey } from "@/config/modules";

const moduleSchema = z.enum(MODULE_KEYS);

export async function getCategories(module: string) {
  await requireAdmin();
  return prisma.category.findMany({ where: { module }, orderBy: { order: "asc" } });
}

export async function getAllCategories() {
  await requireAdmin();
  return prisma.category.findMany({ orderBy: [{ module: "asc" }, { order: "asc" }] });
}

const createCategorySchema = z.object({
  module: moduleSchema,
  name: z.string().trim().min(1, "Name is required").max(40),
  color: z.string().optional(),
});

export async function createCategory(input: z.infer<typeof createCategorySchema>) {
  await requireAdmin();
  const parsed = createCategorySchema.parse(input);

  const existing = await prisma.category.findUnique({
    where: { module_name: { module: parsed.module, name: parsed.name } },
  });
  if (existing) return existing;

  const maxOrder = await prisma.category.aggregate({
    where: { module: parsed.module },
    _max: { order: true },
  });

  const category = await prisma.category.create({
    data: {
      module: parsed.module,
      name: parsed.name,
      color: parsed.color ?? "#6b7280",
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  revalidatePath(`/${parsed.module}`);
  revalidatePath("/settings");
  return category;
}

const updateCategorySchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(40).optional(),
  color: z.string().optional(),
});

export async function updateCategory(input: z.infer<typeof updateCategorySchema>) {
  await requireAdmin();
  const parsed = updateCategorySchema.parse(input);
  const { id, ...data } = parsed;
  const category = await prisma.category.update({ where: { id }, data });
  revalidatePath(`/${category.module}`);
  revalidatePath("/settings");
  return category;
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const category = await prisma.category.delete({ where: { id } });
  await clearCategoryFromModule(category.module as import("@/config/modules").ModuleKey, id);
  revalidatePath(`/${category.module}`);
  revalidatePath("/settings");
}
