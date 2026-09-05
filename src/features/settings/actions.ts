"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { getSession, reissueSessionCookie } from "@/lib/auth/session";
import { countRemainingRecoveryCodes } from "@/lib/auth/recovery-codes";
import { sendMail } from "@/lib/mail/send-mail";
import { buildSecurityAlertEmail } from "@/lib/mail/templates/security-alert";

export interface SettingsActionResult {
  success: boolean;
  error?: string;
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dots, dashes and underscores"),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateProfile(input: ProfileInput): Promise<SettingsActionResult> {
  const admin = await requireAdmin();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid profile details." };
  }

  const conflict = await prisma.admin.findFirst({
    where: {
      id: { not: admin.id },
      OR: [{ email: parsed.data.email }, { username: parsed.data.username }],
    },
  });
  if (conflict) {
    return { success: false, error: "That username or email is already in use." };
  }

  const emailChanged = parsed.data.email.toLowerCase() !== admin.email.toLowerCase();

  await prisma.admin.update({
    where: { id: admin.id },
    data: parsed.data,
  });

  await logActivity({ action: "updated", module: "Admin", description: "Updated profile details" });

  if (emailChanged) {
    const alert = buildSecurityAlertEmail({
      name: admin.name,
      title: "Account email changed",
      message: `Your IT Manager Portal account email was changed from ${admin.email} to ${parsed.data.email}.`,
    });
    // Notify the OLD address — if this change wasn't made by the account owner, that's who needs to know.
    await sendMail({ to: admin.email, ...alert, context: { adminId: admin.id, label: admin.name } });
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function changePassword(input: ChangePasswordInput): Promise<SettingsActionResult> {
  const currentAdmin = await requireAdmin();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid password details." };
  }

  const admin = await prisma.admin.findUnique({ where: { id: currentAdmin.id } });
  if (!admin) return { success: false, error: "Account not found." };

  const matches = await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash);
  if (!matches) {
    return { success: false, error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
  // Keep this device signed in under the new sessionVersion; every other device's cookie is now stale.
  await reissueSessionCookie(updated.sessionVersion);

  await logActivity({ action: "updated", module: "Admin", description: "Changed account password — all other devices were signed out" });

  const alert = buildSecurityAlertEmail({
    name: admin.name,
    title: "Password changed",
    message: "Your IT Manager Portal password was just changed. You've been signed out of every other device.",
  });
  await sendMail({ to: admin.email, ...alert, context: { adminId: admin.id, label: admin.name } });

  return { success: true };
}

// ── Two-factor authentication ──────────────────────────────────────────────

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const currentAdmin = await requireAdmin();
  const admin = await prisma.admin.findUniqueOrThrow({ where: { id: currentAdmin.id } });
  return {
    enabled: admin.twoFactorEnabled,
    recoveryCodesRemaining: countRemainingRecoveryCodes(admin.twoFactorRecoveryCodes),
  };
}

export interface BeginEnrollmentResult {
  success: boolean;
  error?: string;
  qrDataUrl?: string;
  manualKey?: string;
}

/** Generates a fresh TOTP secret and stores it (encrypted) unconfirmed — twoFactorEnabled stays false until `confirmTwoFactorEnrollment` verifies a code. */
export async function beginTwoFactorEnrollment(): Promise<BeginEnrollmentResult> {
  await requireAdmin();
  // This portal is single-admin with no second login step by design (the
  // login action ignores twoFactorEnabled entirely) — refuse new enrollment
  // server-side too, not just by hiding the button in Settings.
  return { success: false, error: "Two-factor authentication is turned off for this portal." };
}

export async function disableTwoFactor(input: { password: string }): Promise<SettingsActionResult> {
  const admin = await requireAdmin();
  const record = await prisma.admin.findUniqueOrThrow({ where: { id: admin.id } });

  const matches = await bcrypt.compare(input.password, record.passwordHash);
  if (!matches) {
    return { success: false, error: "Incorrect password." };
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorSecretIv: null,
      twoFactorSecretAuthTag: null,
      twoFactorRecoveryCodes: null,
    },
  });

  await logActivity({ action: "two_factor_disabled", module: "Admin", description: "Disabled two-factor authentication" });

  const alert = buildSecurityAlertEmail({
    name: admin.name,
    title: "Two-factor authentication disabled",
    message: "Two-factor authentication was just turned off for your IT Manager Portal account.",
  });
  await sendMail({ to: admin.email, ...alert, context: { adminId: admin.id, label: admin.name } });

  revalidatePath("/settings");
  return { success: true };
}


// ── Active sessions ─────────────────────────────────────────────────────────

export interface ActiveSessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  isCurrent: boolean;
}

export async function getActiveSessions(): Promise<ActiveSessionInfo[]> {
  const admin = await requireAdmin();
  const session = await getSession();

  const sessions = await prisma.session.findMany({
    where: { adminId: admin.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt,
    isCurrent: s.id === session?.sessionId,
  }));
}

export async function logoutAllOtherDevices(): Promise<SettingsActionResult> {
  const admin = await requireAdmin();
  const session = await getSession();

  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data: { sessionVersion: { increment: 1 } },
  });

  await prisma.session.updateMany({
    where: { adminId: admin.id, revokedAt: null, ...(session?.sessionId ? { id: { not: session.sessionId } } : {}) },
    data: { revokedAt: new Date() },
  });

  // Re-sign this device's own cookie under the new version so it stays logged in.
  await reissueSessionCookie(updated.sessionVersion);

  await logActivity({ action: "sessions_revoked", module: "Admin", description: "Signed out of all other devices" });
  revalidatePath("/settings");
  return { success: true };
}
