"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { decrypt, encrypt } from "@/lib/security/encryption";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { credentialSchema, type CredentialFormValues } from "@/features/credentials/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "credentials" as const;

export async function getCredentials(includeArchived = false) {
  await requireAdmin();
  return prisma.credential.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { platform: "asc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

export async function createCredential(input: CredentialFormValues) {
  await requireAdmin();
  const parsed = credentialSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  if (!parsed.password) {
    throw new Error("Password is required for a new credential");
  }
  const { ciphertext, iv, authTag } = encrypt(parsed.password);

  const credential = await prisma.credential.create({
    data: {
      platform: parsed.platform,
      url: parsed.url || null,
      username: parsed.username || null,
      encryptedPassword: ciphertext,
      iv,
      authTag,
      categoryId: parsed.categoryId || null,
      notes: parsed.notes || null,
      customFields: serializeJsonValue(customFields),
    },
  });

  await setRecordTags({ module: MODULE, recordId: credential.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: credential.id, label: credential.platform, description: `Added credential for ${credential.platform}` });

  revalidatePath("/credentials");
  revalidatePath("/dashboard");
  return credential;
}

export async function updateCredential(id: string, input: CredentialFormValues) {
  await requireAdmin();
  const parsed = credentialSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const secretFields = parsed.password
    ? (() => {
        const { ciphertext, iv, authTag } = encrypt(parsed.password!);
        return { encryptedPassword: ciphertext, iv, authTag };
      })()
    : {};

  const credential = await prisma.credential.update({
    where: { id },
    data: {
      platform: parsed.platform,
      url: parsed.url || null,
      username: parsed.username || null,
      categoryId: parsed.categoryId || null,
      notes: parsed.notes || null,
      customFields: serializeJsonValue(customFields),
      ...secretFields,
    },
  });

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({
    action: "updated",
    module: MODULE,
    recordId: id,
    label: credential.platform,
    description: parsed.password ? `Rotated password for ${credential.platform}` : `Updated credential for ${credential.platform}`,
  });

  revalidatePath("/credentials");
  return credential;
}

export async function archiveCredential(id: string) {
  await requireAdmin();
  const credential = await prisma.credential.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: credential.platform, description: `Archived credential for ${credential.platform}` });
  revalidatePath("/credentials");
}

export async function restoreCredential(id: string) {
  await requireAdmin();
  const credential = await prisma.credential.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: credential.platform, description: `Restored credential for ${credential.platform}` });
  revalidatePath("/credentials");
}

export async function deleteCredential(id: string) {
  await requireAdmin();
  const credential = await prisma.credential.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: credential.platform, description: `Deleted credential for ${credential.platform}` });
  revalidatePath("/credentials");
}

export async function duplicateCredential(id: string) {
  await requireAdmin();
  const original = await prisma.credential.findUniqueOrThrow({ where: { id } });

  const copy = await prisma.credential.create({
    data: {
      platform: `${original.platform} (Copy)`,
      url: original.url,
      username: original.username,
      encryptedPassword: original.encryptedPassword,
      iv: original.iv,
      authTag: original.authTag,
      categoryId: original.categoryId,
      notes: original.notes,
      customFields: original.customFields ?? undefined,
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.platform, description: `Duplicated credential ${original.platform}` });

  revalidatePath("/credentials");
  return copy;
}

/** Decrypts and returns a password — only ever called after an explicit "Show password" click, never on list load. */
export async function revealCredentialPassword(id: string): Promise<string> {
  await requireAdmin();
  const credential = await prisma.credential.findUniqueOrThrow({ where: { id } });
  const plaintext = decrypt({
    ciphertext: credential.encryptedPassword,
    iv: credential.iv,
    authTag: credential.authTag,
  });

  await logActivity({
    action: "password_revealed",
    module: MODULE,
    recordId: id,
    label: credential.platform,
    description: `Viewed password for ${credential.platform}`,
  });

  return plaintext;
}

export async function getCredentialTagIds(id: string) {
  await requireAdmin();
  return getRecordTagIds(MODULE, id);
}
