"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { employeeSchema, DELETE_ALL_CONFIRMATION_PHRASE, type EmployeeFormValues } from "@/features/employees/schema";
import { serializeJsonValue } from "@/lib/json";
import type { Employee } from "@prisma/client";

const MODULE = "employees" as const;

/**
 * Server actions return this instead of throwing for expected, user-facing
 * failures (a duplicate Employee ID) — thrown Error messages from Server
 * Actions aren't guaranteed to reach the client verbatim, but returned data
 * always does. Genuinely unexpected errors (a bad Zod parse bypassing the
 * client resolver, a DB outage) still throw, same as every other action.
 */
export type EmployeeMutationResult =
  | { success: true; employee: Employee }
  | { success: false; error: string; field?: "employeeId" | "email" };

export async function getEmployees(includeArchived = false) {
  await requireAdmin();
  return prisma.employee.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

/** Pre-check so the common case gets a clean, specific message instead of a raw DB error. The DB's unique index is still the authoritative guard against a race between this check and the write. */
async function findEmployeeIdConflict(employeeId: string, excludeId?: string) {
  const existing = await prisma.employee.findUnique({ where: { employeeId }, select: { id: true } });
  return existing && existing.id !== excludeId ? existing : null;
}

function isUniqueConstraintError(error: unknown, target: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    !!(error.meta?.target as string[] | undefined)?.includes(target)
  );
}

export async function createEmployee(input: EmployeeFormValues): Promise<EmployeeMutationResult> {
  await requireAdmin();
  const parsed = employeeSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  if (await findEmployeeIdConflict(parsed.employeeId)) {
    return { success: false, field: "employeeId", error: "Employee ID already exists. Please use a unique Employee ID." };
  }

  let employee: Employee;
  try {
    employee = await prisma.employee.create({
      data: {
        employeeId: parsed.employeeId,
        name: parsed.name,
        department: parsed.department,
        email: parsed.email,
        phone: parsed.phone || null,
        dateOfBirth: new Date(parsed.dateOfBirth),
        joiningDate: new Date(parsed.joiningDate),
        status: parsed.status,
        categoryId: parsed.categoryId || null,
        notes: parsed.notes || null,
        customFields: serializeJsonValue(customFields),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "employeeId")) {
      return { success: false, field: "employeeId", error: "Employee ID already exists. Please use a unique Employee ID." };
    }
    if (isUniqueConstraintError(error, "email")) {
      return { success: false, field: "email", error: "An employee with this email already exists." };
    }
    throw error;
  }

  await setRecordTags({ module: MODULE, recordId: employee.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: employee.id, label: employee.name, description: `Added employee ${employee.name}` });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return { success: true, employee };
}

export async function updateEmployee(id: string, input: EmployeeFormValues): Promise<EmployeeMutationResult> {
  await requireAdmin();
  const parsed = employeeSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  if (await findEmployeeIdConflict(parsed.employeeId, id)) {
    return { success: false, field: "employeeId", error: "Employee ID already exists. Please use a unique Employee ID." };
  }

  let employee: Employee;
  try {
    employee = await prisma.employee.update({
      where: { id },
      data: {
        employeeId: parsed.employeeId,
        name: parsed.name,
        department: parsed.department,
        email: parsed.email,
        phone: parsed.phone || null,
        dateOfBirth: new Date(parsed.dateOfBirth),
        joiningDate: new Date(parsed.joiningDate),
        status: parsed.status,
        categoryId: parsed.categoryId || null,
        notes: parsed.notes || null,
        customFields: serializeJsonValue(customFields),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "employeeId")) {
      return { success: false, field: "employeeId", error: "Employee ID already exists. Please use a unique Employee ID." };
    }
    if (isUniqueConstraintError(error, "email")) {
      return { success: false, field: "email", error: "An employee with this email already exists." };
    }
    throw error;
  }

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: employee.name, description: `Updated employee ${employee.name}` });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return { success: true, employee };
}

export async function archiveEmployee(id: string) {
  await requireAdmin();
  const employee = await prisma.employee.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: employee.name, description: `Archived employee ${employee.name}` });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
}

export async function restoreEmployee(id: string) {
  await requireAdmin();
  const employee = await prisma.employee.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: employee.name, description: `Restored employee ${employee.name}` });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
}

export async function deleteEmployee(id: string) {
  await requireAdmin();
  const employee = await prisma.employee.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: employee.name, description: `Deleted employee ${employee.name}` });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
}

export async function duplicateEmployee(id: string) {
  await requireAdmin();
  const original = await prisma.employee.findUniqueOrThrow({ where: { id } });

  const [localPart, domain] = original.email.split("@");
  let email = `${localPart}+copy@${domain}`;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.employee.findUnique({ where: { email } })) {
    suffix += 1;
    email = `${localPart}+copy${suffix}@${domain}`;
  }

  const copy = await prisma.employee.create({
    data: {
      // Employee ID must stay unique — left blank rather than guessed, same
      // as every other bulk/duplicate flow that can't invent a real value.
      employeeId: null,
      name: `${original.name} (Copy)`,
      department: original.department,
      email,
      phone: original.phone,
      dateOfBirth: original.dateOfBirth,
      joiningDate: original.joiningDate,
      status: original.status,
      categoryId: original.categoryId,
      notes: original.notes,
      customFields: original.customFields ?? undefined,
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.name, description: `Duplicated employee ${original.name}` });

  revalidatePath("/employees");
  return copy;
}

export async function getEmployeeTagIds(id: string) {
  await requireAdmin();
  return getRecordTagIds(MODULE, id);
}

export type DeleteAllEmployeesResult = { success: true; deletedCount: number } | { success: false; error: string };

/**
 * Permanently deletes every employee record (active and archived). Extremely
 * destructive by design — gated on requireAdmin() (never trust the client
 * hiding the button) and on the admin typing an exact confirmation phrase,
 * checked again here rather than trusted from the client. Only ever touches
 * the `employees` table: System.assignedEmployeeId is nulled out and
 * AllocationHistory rows cascade per the existing FK constraints already in
 * the schema — nothing outside those two, already-employee-scoped relations
 * is touched. No cascading to unrelated modules (credentials, documents,
 * tasks, network, admin/session/auth data) is possible because none of them
 * hold a foreign key to Employee.
 */
export async function deleteAllEmployees(confirmationPhrase: string): Promise<DeleteAllEmployeesResult> {
  const admin = await requireAdmin();

  if (confirmationPhrase !== DELETE_ALL_CONFIRMATION_PHRASE) {
    return { success: false, error: "Confirmation phrase did not match. No employees were deleted." };
  }

  const countBefore = await prisma.employee.count();
  if (countBefore === 0) {
    return { success: false, error: "There are no employees to delete." };
  }

  try {
    const { count } = await prisma.employee.deleteMany({});

    await logActivity({
      action: "deleted_all_employees",
      module: MODULE,
      description: `DELETE_ALL_EMPLOYEES by ${admin.name}: ${count} employee record(s) permanently deleted (SUCCESS)`,
    });

    revalidatePath("/employees");
    revalidatePath("/dashboard");

    return { success: true, deletedCount: count };
  } catch {
    await logActivity({
      action: "deleted_all_employees",
      module: MODULE,
      description: `DELETE_ALL_EMPLOYEES by ${admin.name}: failed (FAILED)`,
    });
    return { success: false, error: "Something went wrong while deleting employees. Check the employee list before retrying." };
  }
}
