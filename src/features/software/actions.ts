"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { encrypt, decrypt, type EncryptedPayload } from "@/lib/security/encryption";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { softwareSchema, type SoftwareFormValues } from "@/features/software/schema";
import { normalizeCustomFields, serializeJsonValue } from "@/lib/json";

const MODULE = "software" as const;

export async function getSoftwareList(includeArchived = false) {
  return prisma.software.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
  });
}

/** The "password" custom field def is reserved — its value is an encrypted {ciphertext,iv,authTag}
 * payload, not the plain string the generic custom-fields engine expects, so it never flows through
 * the generic validation pipeline (see createSoftware/updateSoftware, which manage it separately). */
async function validateCustomFields(values: Record<string, unknown>) {
  const { password: _reserved, ...rest } = values;
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(rest) as Record<string, unknown>;
}

function toData(parsed: SoftwareFormValues, customFields: Record<string, unknown>) {
  return {
    name: parsed.name,
    version: parsed.version || null,
    licenseKey: parsed.licenseKey || null,
    licenseType: parsed.licenseType || null,
    expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null,
    downloadLink: parsed.downloadLink || null,
    categoryId: parsed.categoryId || null,
    notes: parsed.notes || null,
    customFields: serializeJsonValue(customFields),
  };
}

export async function createSoftware(input: SoftwareFormValues) {
  await requireAdmin();
  const parsed = softwareSchema.parse(input);
  if (!parsed.password) {
    throw new Error("Password is required for a new Microsoft 365 user");
  }
  const customFields = await validateCustomFields(parsed.customFields);
  const { ciphertext, iv, authTag } = encrypt(parsed.password);
  customFields.password = { ciphertext, iv, authTag };

  const software = await prisma.software.create({ data: toData(parsed, customFields) });
  await setRecordTags({ module: MODULE, recordId: software.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: software.id, label: software.name, description: `Added Microsoft 365 user ${software.name}` });

  revalidatePath("/software");
  revalidatePath("/dashboard");
  return software;
}

export async function updateSoftware(id: string, input: SoftwareFormValues) {
  await requireAdmin();
  const parsed = softwareSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  if (parsed.password) {
    const { ciphertext, iv, authTag } = encrypt(parsed.password);
    customFields.password = { ciphertext, iv, authTag };
  } else {
    const current = await prisma.software.findUnique({ where: { id }, select: { customFields: true } });
    const currentFields = normalizeCustomFields(current?.customFields) as Record<string, unknown>;
    if (currentFields.password) customFields.password = currentFields.password;
  }

  const software = await prisma.software.update({ where: { id }, data: toData(parsed, customFields) });
  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: software.name, description: `Updated Microsoft 365 user ${software.name}` });

  revalidatePath("/software");
  return software;
}

export async function archiveSoftware(id: string) {
  await requireAdmin();
  const software = await prisma.software.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: software.name, description: `Archived software ${software.name}` });
  revalidatePath("/software");
}

export async function restoreSoftware(id: string) {
  await requireAdmin();
  const software = await prisma.software.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: software.name, description: `Restored software ${software.name}` });
  revalidatePath("/software");
}

export async function deleteSoftware(id: string) {
  await requireAdmin();
  const software = await prisma.software.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: software.name, description: `Deleted software ${software.name}` });
  revalidatePath("/software");
}

export async function duplicateSoftware(id: string) {
  await requireAdmin();
  const original = await prisma.software.findUniqueOrThrow({ where: { id } });

  // Never clone a live email+password pair — the copy needs its own identity.
  const originalFields = normalizeCustomFields(original.customFields) as Record<string, unknown>;
  const { mail_id: _mailId, password: _password, ...restFields } = originalFields;

  const copy = await prisma.software.create({
    data: {
      name: `${original.name} (Copy)`,
      version: original.version,
      licenseKey: original.licenseKey,
      licenseType: original.licenseType,
      expiryDate: original.expiryDate,
      downloadLink: original.downloadLink,
      categoryId: original.categoryId,
      notes: original.notes,
      customFields: serializeJsonValue(restFields),
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.name, description: `Duplicated software ${original.name}` });

  revalidatePath("/software");
  return copy;
}

export async function getSoftwareTagIds(id: string) {
  return getRecordTagIds(MODULE, id);
}

/** Decrypts and returns a Microsoft 365 user's password — only ever called after an explicit
 * "Show password" click or a credential download, never on list load. */
export async function revealSoftwarePassword(id: string): Promise<string> {
  await requireAdmin();
  const software = await prisma.software.findUniqueOrThrow({ where: { id } });
  const customFields = normalizeCustomFields(software.customFields) as Record<string, unknown>;
  const stored = customFields.password;
  if (!stored) return "";

  // Defensive fallback for any row not yet run through the encryption migration.
  const plaintext = typeof stored === "string" ? stored : decrypt(stored as EncryptedPayload);

  await logActivity({ action: "password_revealed", module: MODULE, recordId: id, label: software.name, description: `Viewed password for ${software.name}` });
  return plaintext;
}

/** Lightweight quick action — rotates only the password, without touching the rest of the record. */
export async function resetSoftwarePassword(id: string, newPassword: string) {
  await requireAdmin();
  if (!newPassword) throw new Error("A new password is required");

  const software = await prisma.software.findUniqueOrThrow({ where: { id } });
  const customFields = normalizeCustomFields(software.customFields) as Record<string, unknown>;
  const { ciphertext, iv, authTag } = encrypt(newPassword);
  customFields.password = { ciphertext, iv, authTag };

  await prisma.software.update({ where: { id }, data: { customFields: serializeJsonValue(customFields) } });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: software.name, description: `Reset password for ${software.name}` });
  revalidatePath("/software");
}

/** Lightweight quick action — changes only the license string, without opening the full edit form. */
export async function updateSoftwareLicense(id: string, licenseType: string) {
  await requireAdmin();
  const software = await prisma.software.update({ where: { id }, data: { licenseType: licenseType.trim() || null } });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: software.name, description: `Changed license for ${software.name}` });
  revalidatePath("/software");
  return software;
}
