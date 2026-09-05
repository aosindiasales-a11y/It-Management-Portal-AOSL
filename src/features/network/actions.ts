"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { decrypt, encrypt } from "@/lib/security/encryption";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { networkSchema, type NetworkFormValues } from "@/features/network/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "network" as const;

export async function getNetworkConfigs(includeArchived = false) {
  await requireAdmin();
  return prisma.networkConfig.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { label: "asc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

function baseData(parsed: NetworkFormValues) {
  return {
    label: parsed.label,
    wifiName: parsed.wifiName || null,
    routerIp: parsed.routerIp || null,
    gateway: parsed.gateway || null,
    dns: parsed.dns || null,
    isp: parsed.isp || null,
    bandwidth: parsed.bandwidth || null,
    routerLoginUser: parsed.routerLoginUser || null,
    routerLoginPass: parsed.routerLoginPass || null,
    categoryId: parsed.categoryId || null,
    notes: parsed.notes || null,
  };
}

export async function createNetworkConfig(input: NetworkFormValues) {
  await requireAdmin();
  const parsed = networkSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const secret = parsed.wifiPassword ? encrypt(parsed.wifiPassword) : null;

  const config = await prisma.networkConfig.create({
    data: {
      ...baseData(parsed),
      customFields: serializeJsonValue(customFields),
      encryptedPassword: secret?.ciphertext ?? null,
      iv: secret?.iv ?? null,
      authTag: secret?.authTag ?? null,
    },
  });

  await setRecordTags({ module: MODULE, recordId: config.id, tagIds: parsed.tagIds });
  await logActivity({ action: "created", module: MODULE, recordId: config.id, label: config.label, description: `Added network config ${config.label}` });

  revalidatePath("/network");
  revalidatePath("/dashboard");
  return config;
}

export async function updateNetworkConfig(id: string, input: NetworkFormValues) {
  await requireAdmin();
  const parsed = networkSchema.parse(input);
  const customFields = await validateCustomFields(parsed.customFields);

  const secretFields = parsed.wifiPassword
    ? (() => {
        const { ciphertext, iv, authTag } = encrypt(parsed.wifiPassword!);
        return { encryptedPassword: ciphertext, iv, authTag };
      })()
    : {};

  const config = await prisma.networkConfig.update({
    where: { id },
    data: { ...baseData(parsed), customFields: serializeJsonValue(customFields), ...secretFields },
  });

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: config.label, description: `Updated network config ${config.label}` });

  revalidatePath("/network");
  return config;
}

export async function archiveNetworkConfig(id: string) {
  await requireAdmin();
  const config = await prisma.networkConfig.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: config.label, description: `Archived network config ${config.label}` });
  revalidatePath("/network");
}

export async function restoreNetworkConfig(id: string) {
  await requireAdmin();
  const config = await prisma.networkConfig.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: config.label, description: `Restored network config ${config.label}` });
  revalidatePath("/network");
}

export async function deleteNetworkConfig(id: string) {
  await requireAdmin();
  const config = await prisma.networkConfig.delete({ where: { id } });
  await logActivity({ action: "deleted", module: MODULE, label: config.label, description: `Deleted network config ${config.label}` });
  revalidatePath("/network");
}

export async function duplicateNetworkConfig(id: string) {
  await requireAdmin();
  const original = await prisma.networkConfig.findUniqueOrThrow({ where: { id } });

  const copy = await prisma.networkConfig.create({
    data: {
      label: `${original.label} (Copy)`,
      wifiName: original.wifiName,
      encryptedPassword: original.encryptedPassword,
      iv: original.iv,
      authTag: original.authTag,
      routerIp: original.routerIp,
      gateway: original.gateway,
      dns: original.dns,
      isp: original.isp,
      bandwidth: original.bandwidth,
      routerLoginUser: original.routerLoginUser,
      routerLoginPass: original.routerLoginPass,
      categoryId: original.categoryId,
      notes: original.notes,
      customFields: original.customFields ?? undefined,
    },
  });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.label, description: `Duplicated network config ${original.label}` });

  revalidatePath("/network");
  return copy;
}

export async function revealWifiPassword(id: string): Promise<string> {
  await requireAdmin();
  const config = await prisma.networkConfig.findUniqueOrThrow({ where: { id } });
  if (!config.encryptedPassword || !config.iv || !config.authTag) return "";
  const plaintext = decrypt({ ciphertext: config.encryptedPassword, iv: config.iv, authTag: config.authTag });

  await logActivity({ action: "password_revealed", module: MODULE, recordId: id, label: config.label, description: `Viewed WiFi password for ${config.label}` });

  return plaintext;
}

export async function getNetworkTagIds(id: string) {
  await requireAdmin();
  return getRecordTagIds(MODULE, id);
}
