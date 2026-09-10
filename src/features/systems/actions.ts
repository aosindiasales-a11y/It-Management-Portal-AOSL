"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { systemSchema, type SystemFormValues } from "@/features/systems/schema";
import { serializeJsonValue } from "@/lib/json";
import type { System } from "@prisma/client";

const MODULE = "systems" as const;

/**
 * Server actions return this instead of throwing for expected, user-facing
 * failures (a duplicate Asset Code / Serial Number) — thrown Error messages
 * from Server Actions aren't guaranteed to reach the client verbatim, but
 * returned data always does. Genuinely unexpected errors still throw.
 */
export type SystemMutationResult =
  | { success: true; system: System }
  | { success: false; error: string; field?: "assetId" | "serialNumber" };

function isUniqueConstraintError(error: unknown, target: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    !!(error.meta?.target as string[] | undefined)?.includes(target)
  );
}

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

/**
 * Keeps status and assignment in sync for the common cases without
 * overriding a deliberate REPAIR/RETIRED choice: picking an employee while
 * status is still the idle default flips it to ALLOCATED, and clearing the
 * employee while status is ALLOCATED flips it back to VACANT.
 */
function deriveStatus(status: SystemFormValues["status"], assignedEmployeeId: string | null): SystemFormValues["status"] {
  if (assignedEmployeeId && status === "VACANT") return "ALLOCATED";
  if (!assignedEmployeeId && status === "ALLOCATED") return "VACANT";
  return status;
}

function toData(parsed: SystemFormValues, customFields: Record<string, unknown>) {
  const assignedEmployeeId = parsed.assignedEmployeeId || null;
  return {
    assetId: parsed.assetId,
    name: parsed.name,
    assetType: parsed.assetType || null,
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
    status: deriveStatus(parsed.status, assignedEmployeeId),
    keyboard: parsed.keyboard ?? null,
    mousePad: parsed.mousePad ?? null,
    charger: parsed.charger ?? null,
    categoryId: parsed.categoryId || null,
    location: parsed.location || null,
    notes: parsed.notes || null,
    assignedEmployeeId,
    credentialId: parsed.credentialId || null,
    customFields: serializeJsonValue(customFields),
  };
}

export async function createSystem(input: SystemFormValues): Promise<SystemMutationResult> {
  await requireAdmin();
  const parsed = systemSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  let system: System;
  try {
    system = await prisma.system.create({ data: toData(parsed, customFields) });
  } catch (error) {
    if (isUniqueConstraintError(error, "assetId")) {
      return { success: false, field: "assetId", error: "Asset Code already exists. Please use a unique Asset Code." };
    }
    if (isUniqueConstraintError(error, "serialNumber")) {
      return { success: false, field: "serialNumber", error: "A system with this Serial Number already exists." };
    }
    throw error;
  }

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
  return { success: true, system };
}

export async function updateSystem(id: string, input: SystemFormValues): Promise<SystemMutationResult> {
  await requireAdmin();
  const parsed = systemSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const previous = await prisma.system.findUniqueOrThrow({ where: { id } });

  let system: System;
  try {
    system = await prisma.system.update({ where: { id }, data: toData(parsed, customFields) });
  } catch (error) {
    if (isUniqueConstraintError(error, "assetId")) {
      return { success: false, field: "assetId", error: "Asset Code already exists. Please use a unique Asset Code." };
    }
    if (isUniqueConstraintError(error, "serialNumber")) {
      return { success: false, field: "serialNumber", error: "A system with this Serial Number already exists." };
    }
    throw error;
  }

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
  return { success: true, system };
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
      assetType: original.assetType,
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
      // A duplicate is a new, unassigned physical unit — never inherit ALLOCATED without an assigned employee.
      status: original.status === "ALLOCATED" ? "VACANT" : original.status,
      keyboard: original.keyboard,
      mousePad: original.mousePad,
      charger: original.charger,
      categoryId: original.categoryId,
      location: original.location,
      notes: original.notes,
      // A duplicated asset gets its own credential reference, never a shared copy of another asset's link.
      credentialId: null,
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

export type AssignSystemResult = { success: true } | { success: false; error: string };

/**
 * The "Assign / Reassign" quick action (distinct from the full Edit form):
 * always drives the asset to ALLOCATED and records the handover in both the
 * allocation history and the asset's timeline, closing out the previous
 * owner's open allocation window if there was one.
 */
export async function assignSystem(systemId: string, employeeId: string): Promise<AssignSystemResult> {
  await requireAdmin();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { success: false, error: "Selected employee does not exist." };

  const previous = await prisma.system.findUniqueOrThrow({ where: { id: systemId } });
  const alreadyAssignedToThisEmployee = previous.assignedEmployeeId === employeeId;

  const system = await prisma.system.update({
    where: { id: systemId },
    data: { assignedEmployeeId: employeeId, status: "ALLOCATED" },
  });

  if (!alreadyAssignedToThisEmployee) {
    if (previous.assignedEmployeeId) {
      await prisma.allocationHistory.updateMany({
        where: { systemId, employeeId: previous.assignedEmployeeId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
    }
    await prisma.allocationHistory.create({ data: { systemId, employeeId } });
    await prisma.systemHistoryEntry.create({
      data: {
        systemId,
        eventType: previous.assignedEmployeeId ? "Reassigned" : "Assigned",
        description: `Allocated to ${employee.name}`,
      },
    });
  }

  await logActivity({
    action: "assigned",
    module: MODULE,
    recordId: systemId,
    label: system.name,
    description: `Assigned ${system.name} (${system.assetId}) to ${employee.name}`,
  });

  revalidatePath("/systems");
  revalidatePath("/dashboard");
  return { success: true };
}

/** The "Mark Vacant" quick action: clears the assigned employee and drives the asset to VACANT without deleting it. */
export async function markSystemVacant(systemId: string): Promise<void> {
  await requireAdmin();
  const previous = await prisma.system.findUniqueOrThrow({ where: { id: systemId } });

  const system = await prisma.system.update({
    where: { id: systemId },
    data: { assignedEmployeeId: null, status: "VACANT" },
  });

  if (previous.assignedEmployeeId) {
    await prisma.allocationHistory.updateMany({
      where: { systemId, employeeId: previous.assignedEmployeeId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
    await prisma.systemHistoryEntry.create({
      data: { systemId, eventType: "Marked vacant", description: "Unallocated" },
    });
  }

  await logActivity({
    action: "unassigned",
    module: MODULE,
    recordId: systemId,
    label: system.name,
    description: `Marked ${system.name} (${system.assetId}) vacant`,
  });

  revalidatePath("/systems");
  revalidatePath("/dashboard");
}
