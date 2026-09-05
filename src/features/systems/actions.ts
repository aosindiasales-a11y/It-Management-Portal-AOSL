"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { systemSchema, type SystemFormValues } from "@/features/systems/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "systems" as const;

export async function getSystems(includeArchived = false) {
  await requireAdmin();
  return prisma.system.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

function toData(parsed: SystemFormValues, customFields: Record<string, unknown>) {
  return {
    assetId: parsed.assetId,
    name: parsed.name,
    serialNumber: parsed.serialNumber || null,
    manufacturer: parsed.manufacturer || null,
    model: parsed.model || null,
    processor: parsed.processor || null,
    ram: parsed.ram || null,
    storage: parsed.storage || null,
    osVersion: parsed.osVersion || null,
    officeVersion: parsed.officeVersion || null,
    purchaseDate: parsed.purchaseDate ? new Date(parsed.purchaseDate) : null,
    warrantyExpiry: parsed.warrantyExpiry ? new Date(parsed.warrantyExpiry) : null,
    status: parsed.status,
    categoryId: parsed.categoryId || null,
    location: parsed.location || null,
    notes: parsed.notes || null,
    assignedEmployeeId: parsed.assignedEmployeeId || null,
    customFields: serializeJsonValue(customFields),
  };
}

export async function createSystem(input: SystemFormValues) {
  await requireAdmin();
  const parsed = systemSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const system = await prisma.system.create({ data: toData(parsed, customFields) });

  await prisma.systemHistoryEntry.create({
    data: { systemId: system.id, eventType: "Registered", description: "Asset added to the registry" },
  });

  if (system.assignedEmployeeId) {
    await prisma.allocationHistory.create({
      data: { employeeId: system.assignedEmployeeId, systemId: system.id },
    });
  }

  await setRecordTags({ module: MODULE, recordId: system.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: system.id, label: system.name, description: `Registered system ${system.name} (${system.assetId})` });

  revalidatePath("/systems");
  revalidatePath("/dashboard");
  return system;
}

export async function updateSystem(id: string, input: SystemFormValues) {
  await requireAdmin();
  const parsed = systemSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const previous = await prisma.system.findUniqueOrThrow({ where: { id } });
  const system = await prisma.system.update({ where: { id }, data: toData(parsed, customFields) });

  if (previous.assignedEmployeeId !== system.assignedEmployeeId) {
    if (previous.assignedEmployeeId) {
      await prisma.allocationHistory.updateMany({
        where: { systemId: id, employeeId: previous.assignedEmployeeId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
    }
    if (system.assignedEmployeeId) {
      await prisma.allocationHistory.create({
        data: { employeeId: system.assignedEmployeeId, systemId: id },
      });
    }
    await prisma.systemHistoryEntry.create({
      data: {
        systemId: id,
        eventType: "Reassigned",
        description: system.assignedEmployeeId ? "Allocated to a new employee" : "Unallocated",
      },
    });
  }

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: system.name, description: `Updated system ${system.name}` });

  revalidatePath("/systems");
  revalidatePath("/dashboard");
  return system;
}

export async function archiveSystem(id: string) {
  await requireAdmin();
  const system = await prisma.system.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: system.name, description: `Archived system ${system.name}` });
  revalidatePath("/systems");
  revalidatePath("/dashboard");
}

export async function restoreSystem(id: string) {
  await requireAdmin();
  const system = await prisma.system.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: system.name, description: `Restored system ${system.name}` });
  revalidatePath("/systems");
  revalidatePath("/dashboard");
}

export async function deleteSystem(id: string) {
  await requireAdmin();
  const system = await prisma.system.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: system.name, description: `Deleted system ${system.name}` });
  revalidatePath("/systems");
  revalidatePath("/dashboard");
}

export async function duplicateSystem(id: string) {
  await requireAdmin();
  const original = await prisma.system.findUniqueOrThrow({ where: { id } });

  let assetId = `${original.assetId}-COPY`;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.system.findUnique({ where: { assetId } })) {
    suffix += 1;
    assetId = `${original.assetId}-COPY${suffix}`;
  }

  const copy = await prisma.system.create({
    data: {
      assetId,
      name: `${original.name} (Copy)`,
      serialNumber: null, // serial numbers must stay unique per physical device
      manufacturer: original.manufacturer,
      model: original.model,
      processor: original.processor,
      ram: original.ram,
      storage: original.storage,
      osVersion: original.osVersion,
      officeVersion: original.officeVersion,
      purchaseDate: original.purchaseDate,
      warrantyExpiry: original.warrantyExpiry,
      status: original.status,
      categoryId: original.categoryId,
      location: original.location,
      notes: original.notes,
      customFields: original.customFields ?? undefined,
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await prisma.systemHistoryEntry.create({
    data: { systemId: copy.id, eventType: "Registered", description: `Duplicated from ${original.name}` },
  });
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.name, description: `Duplicated system ${original.name}` });

  revalidatePath("/systems");
  return copy;
}

export async function getSystemTagIds(id: string) {
  await requireAdmin();
  return getRecordTagIds(MODULE, id);
}

export async function getSystemHistory(id: string) {
  await requireAdmin();
  return prisma.systemHistoryEntry.findMany({ where: { systemId: id }, orderBy: { eventDate: "desc" } });
}

export async function addSystemHistoryEntry(systemId: string, eventType: string, description?: string) {
  await requireAdmin();
  const system = await prisma.system.findUniqueOrThrow({ where: { id: systemId } });
  const entry = await prisma.systemHistoryEntry.create({
    data: { systemId, eventType: eventType.trim(), description: description?.trim() || null },
  });
  await logActivity({
    action: "updated",
    module: MODULE,
    recordId: systemId,
    label: system.name,
    description: `${eventType.trim()} — ${system.name}${description ? `: ${description}` : ""}`,
  });
  revalidatePath("/systems");
  return entry;
}
