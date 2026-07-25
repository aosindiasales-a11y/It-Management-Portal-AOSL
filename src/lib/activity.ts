import "server-only";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth/dal";
import type { ModuleKey } from "@/config/modules";

export type ActivityAction =
  | "created"
  | "updated"
  | "archived"
  | "restored"
  | "deleted"
  | "duplicated"
  | "login"
  | "logout"
  | "password_revealed"
  | "exported"
  | "login_failed"
  | "account_locked"
  | "password_reset_requested"
  | "password_reset_completed"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "two_factor_failed"
  | "recovery_codes_regenerated"
  | "sessions_revoked"
  | "email_sent"
  | "email_failed";

interface LogActivityInput {
  action: ActivityAction;
  module: ModuleKey | "Admin";
  recordId?: string;
  label?: string;
  description: string;
}

/** The N most recent activity entries, across every module — powers the Dashboard's Recent Activity card and the topbar's notification bell. */
export async function getRecentActivity(limit = 6) {
  return prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

/** Writes one row to ActivityLog — the shared source for the dashboard feed and every record's Timeline tab. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  const admin = await getCurrentAdmin();
  await prisma.activityLog.create({
    data: {
      action: input.action,
      entityType: input.module,
      entityId: input.recordId,
      entityLabel: input.label,
      description: input.description,
      adminId: admin?.id,
    },
  });
}
