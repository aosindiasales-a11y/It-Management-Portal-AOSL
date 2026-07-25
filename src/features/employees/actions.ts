"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { employeeSchema, type EmployeeFormValues } from "@/features/employees/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "employees" as const;

export async function getEmployees(includeArchived = false) {
  return prisma.employee.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

export async function createEmployee(input: EmployeeFormValues) {
  await requireAdmin();
  const parsed = employeeSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const employee = await prisma.employee.create({
    data: {
      name: parsed.name,
      department: parsed.department,
      email: parsed.email,
      phone: parsed.phone || null,
      joiningDate: new Date(parsed.joiningDate),
      status: parsed.status,
      categoryId: parsed.categoryId || null,
      notes: parsed.notes || null,
      customFields: serializeJsonValue(customFields),
    },
  });

  await setRecordTags({ module: MODULE, recordId: employee.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: employee.id, label: employee.name, description: `Added employee ${employee.name}` });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return employee;
}

export async function updateEmployee(id: string, input: EmployeeFormValues) {
  await requireAdmin();
  const parsed = employeeSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      name: parsed.name,
      department: parsed.department,
      email: parsed.email,
      phone: parsed.phone || null,
      joiningDate: new Date(parsed.joiningDate),
      status: parsed.status,
      categoryId: parsed.categoryId || null,
      notes: parsed.notes || null,
      customFields: serializeJsonValue(customFields),
    },
  });

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: employee.name, description: `Updated employee ${employee.name}` });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return employee;
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
      name: `${original.name} (Copy)`,
      department: original.department,
      email,
      phone: original.phone,
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
  return getRecordTagIds(MODULE, id);
}
