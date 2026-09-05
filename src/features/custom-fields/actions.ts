"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { CUSTOM_FIELD_TYPES, slugifyFieldKey } from "@/lib/custom-fields/types";
import type { CustomFieldDef } from "@/lib/custom-fields/types";
import { MODULE_KEYS } from "@/config/modules";
import { normalizeCustomFields, serializeJsonValue } from "@/lib/json";

const moduleSchema = z.enum(MODULE_KEYS);

const createFieldSchema = z.object({
  module: moduleSchema,
  label: z.string().trim().min(1, "Label is required").max(60),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.boolean().default(false),
});

export async function getCustomFieldDefs(module: string): Promise<CustomFieldDef[]> {
  await requireAdmin();
  const rows = await prisma.customFieldDefinition.findMany({
    where: { module },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    module: r.module,
    key: r.key,
    label: r.label,
    fieldType: r.fieldType as CustomFieldDef["fieldType"],
    options: r.options ? (JSON.parse(r.options) as string[]) : null,
    required: r.required,
    hidden: r.hidden,
    order: r.order,
  }));
}

export async function createCustomField(input: z.infer<typeof createFieldSchema>) {
  await requireAdmin();
  const parsed = createFieldSchema.parse(input);

  const baseKey = slugifyFieldKey(parsed.label);
  let key = baseKey;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.customFieldDefinition.findUnique({ where: { module_key: { module: parsed.module, key } } })) {
    suffix += 1;
    key = `${baseKey}_${suffix}`;
  }

  const maxOrder = await prisma.customFieldDefinition.aggregate({
    where: { module: parsed.module },
    _max: { order: true },
  });

  await prisma.customFieldDefinition.create({
    data: {
      module: parsed.module,
      key,
      label: parsed.label,
      fieldType: parsed.fieldType,
      options: parsed.options && parsed.options.length > 0 ? JSON.stringify(parsed.options) : null,
      required: parsed.required,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  revalidatePath(`/${parsed.module}`);
  revalidatePath("/settings");
}

const updateFieldSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(60).optional(),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export async function updateCustomField(input: z.infer<typeof updateFieldSchema>) {
  await requireAdmin();
  const parsed = updateFieldSchema.parse(input);
  const { id, ...data } = parsed;

  const field = await prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...data,
      options: data.options ? JSON.stringify(data.options) : null,
    },
  });

  revalidatePath(`/${field.module}`);
  revalidatePath("/settings");
}

export async function deleteCustomField(id: string) {
  await requireAdmin();
  const field = await prisma.customFieldDefinition.delete({ where: { id } });
  revalidatePath(`/${field.module}`);
  revalidatePath("/settings");
}

export async function reorderCustomFields(module: string, orderedIds: string[]) {
  await requireAdmin();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.customFieldDefinition.update({ where: { id }, data: { order: index } })
    )
  );
  revalidatePath(`/${module}`);
  revalidatePath("/settings");
}
