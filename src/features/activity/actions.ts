"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import type { ModuleKey } from "@/config/modules";

export async function getRecordTimeline(module: ModuleKey, recordId: string) {
  await requireAdmin();
  return prisma.activityLog.findMany({
    where: { entityType: module, entityId: recordId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

const AUDIT_LOG_LIMIT = 1000;

/** Full cross-module audit trail — powers the /audit-logs page. */
export async function getAuditLogs() {
  await requireAdmin();
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: AUDIT_LOG_LIMIT,
    include: { admin: { select: { name: true } } },
  });
}

/** Fired by the Export menu on any module's table — records who exported what, in what format, and how many rows. */
export async function logExportEvent(module: ModuleKey | "Admin", label: string, format: "Excel" | "PDF", recordCount: number): Promise<void> {
  await requireAdmin();
  await logActivity({
    action: "exported",
    module,
    label,
    description: `Exported ${recordCount} ${label} record${recordCount === 1 ? "" : "s"} to ${format}`,
  });
}
