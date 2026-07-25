"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { encrypt, decrypt } from "@/lib/security/encryption";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { vpnSchema, type VpnFormValues } from "@/features/vpn/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "vpn" as const;

export async function getVpnCredentials(includeArchived = false) {
  return prisma.vpnCredential.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

function toData(parsed: VpnFormValues, customFields: Record<string, unknown>) {
  return {
    name: parsed.name,
    username: parsed.username || null,
    mailId: parsed.mailId || null,
    status: parsed.status,
    active: parsed.active,
    accountType: parsed.accountType,
    categoryId: parsed.categoryId || null,
    customFields: serializeJsonValue(customFields),
  };
}

export async function createVpnCredential(input: VpnFormValues) {
  await requireAdmin();
  const parsed = vpnSchema.parse(input);
  if (!parsed.password) {
    throw new Error("Password is required for a new VPN credential");
  }
  const customFields = await validateCustomFields(parsed.customFields);
  const { ciphertext, iv, authTag } = encrypt(parsed.password);

  const vpn = await prisma.vpnCredential.create({
    data: { ...toData(parsed, customFields), encryptedPassword: ciphertext, iv, authTag },
  });

  await logActivity({ action: "created", module: MODULE, recordId: vpn.id, label: vpn.name, description: `Added VPN credential ${vpn.name}` });

  revalidatePath("/vpn");
  revalidatePath("/dashboard");
  return vpn;
}

export async function updateVpnCredential(id: string, input: VpnFormValues) {
  await requireAdmin();
  const parsed = vpnSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const secretFields = parsed.password
    ? (() => {
        const { ciphertext, iv, authTag } = encrypt(parsed.password!);
        return { encryptedPassword: ciphertext, iv, authTag };
      })()
    : {};

  const vpn = await prisma.vpnCredential.update({
    where: { id },
    data: { ...toData(parsed, customFields), ...secretFields },
  });

  await logActivity({
    action: "updated",
    module: MODULE,
    recordId: id,
    label: vpn.name,
    description: parsed.password ? `Rotated password for ${vpn.name}` : `Updated VPN credential ${vpn.name}`,
  });

  revalidatePath("/vpn");
  return vpn;
}

export async function archiveVpnCredential(id: string) {
  await requireAdmin();
  const vpn = await prisma.vpnCredential.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: vpn.name, description: `Archived VPN credential ${vpn.name}` });
  revalidatePath("/vpn");
}

export async function restoreVpnCredential(id: string) {
  await requireAdmin();
  const vpn = await prisma.vpnCredential.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: vpn.name, description: `Restored VPN credential ${vpn.name}` });
  revalidatePath("/vpn");
}

export async function deleteVpnCredential(id: string) {
  await requireAdmin();
  const vpn = await prisma.vpnCredential.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: vpn.name, description: `Deleted VPN credential ${vpn.name}` });
  revalidatePath("/vpn");
}

export async function duplicateVpnCredential(id: string) {
  await requireAdmin();
  const original = await prisma.vpnCredential.findUniqueOrThrow({ where: { id } });

  const copy = await prisma.vpnCredential.create({
    data: {
      name: `${original.name} (Copy)`,
      username: original.username,
      encryptedPassword: original.encryptedPassword,
      iv: original.iv,
      authTag: original.authTag,
      mailId: original.mailId,
      status: original.status,
      active: original.active,
      accountType: original.accountType,
      categoryId: original.categoryId,
      customFields: original.customFields ?? undefined,
    },
  });

  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.name, description: `Duplicated VPN credential ${original.name}` });

  revalidatePath("/vpn");
  return copy;
}

/** Decrypts and returns a password — only ever called after an explicit "Show password" click or a "Copy password" action, never on list load. */
export async function revealVpnPassword(id: string): Promise<string> {
  await requireAdmin();
  const vpn = await prisma.vpnCredential.findUniqueOrThrow({ where: { id } });
  const plaintext = decrypt({ ciphertext: vpn.encryptedPassword, iv: vpn.iv, authTag: vpn.authTag });

  await logActivity({ action: "password_revealed", module: MODULE, recordId: id, label: vpn.name, description: `Viewed password for ${vpn.name}` });

  return plaintext;
}
