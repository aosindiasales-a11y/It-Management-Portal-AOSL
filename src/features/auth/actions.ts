"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  createSessionCookie,
  destroySessionCookie,
  getPending2FASession,
  destroyPending2FACookie,
  getSession,
} from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import {
  loginSchema,
  verifyTwoFactorSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginInput,
  type VerifyTwoFactorInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { getCurrentAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { verifyTotpCode } from "@/lib/auth/totp";
import { consumeRecoveryCode } from "@/lib/auth/recovery-codes";
import { createPasswordResetToken, findValidResetToken, markResetTokenUsed } from "@/lib/auth/password-reset";
import { createLoginOtp, verifyLoginOtp, LOGIN_OTP_TTL_MINUTES } from "@/lib/auth/login-otp";
import { sendMail } from "@/lib/mail/send-mail";
import { buildPasswordResetEmail } from "@/lib/mail/templates/password-reset";
import { buildLoginOtpEmail } from "@/lib/mail/templates/login-otp";
import { buildSecurityAlertEmail } from "@/lib/mail/templates/security-alert";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface LoginActionResult {
  success: boolean;
  error?: string;
  requiresTwoFactor?: boolean;
}

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return headerList.get("x-real-ip") ?? "unknown";
}

async function getUserAgent(): Promise<string> {
  const headerList = await headers();
  return headerList.get("user-agent") ?? "Unknown device";
}

type LoginMethod = "password" | "recovery_code" | "email_otp";

const LOGIN_METHOD_SUFFIX: Record<LoginMethod, string> = {
  password: "",
  recovery_code: " using a recovery code",
  email_otp: " using an emailed code",
};

async function startFullSession(admin: { id: string; username: string; sessionVersion: number; name: string }, rememberMe: boolean, method: LoginMethod) {
  const ip = await getClientIp();
  const userAgent = await getUserAgent();

  const session = await prisma.session.create({
    data: { adminId: admin.id, ip, userAgent, rememberMe },
  });

  await createSessionCookie(
    { adminId: admin.id, username: admin.username, sessionVersion: admin.sessionVersion, sessionId: session.id },
    rememberMe
  );

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });

  // Written directly (not via logActivity()'s getCurrentAdmin() lookup) since the
  // session cookie was only just set moments ago in this same action.
  await prisma.activityLog.create({
    data: {
      action: "login",
      entityType: "Admin",
      entityLabel: admin.name,
      description: `${admin.name} signed in${LOGIN_METHOD_SUFFIX[method]}`,
      adminId: admin.id,
    },
  });
}

export async function login(input: LoginInput): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please check your email/username and password." };
  }
  const { identifier, password, rememberMe } = parsed.data;

  const ip = await getClientIp();
  const rateLimitKey = `${ip}:${identifier.toLowerCase()}`;
  const rateLimit = await checkRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.retryAfterMs / 60000);
    return {
      success: false,
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const admin = await prisma.admin.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
  });

  if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
    const minutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      success: false,
      error: `This account is locked from too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  // Always compare against a structurally-valid bcrypt hash (even when no
  // account matches) so response timing doesn't reveal whether the
  // identifier exists, and so bcrypt never throws on a malformed hash.
  const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Q9AL/OiJTdMbvbaNjZ7f7wLGxbEXK";
  const passwordHash = admin?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!admin || !passwordMatches) {
    if (admin) {
      const attempts = admin.failedLoginAttempts + 1;
      const lockingNow = attempts >= MAX_FAILED_ATTEMPTS;
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: lockingNow ? 0 : attempts,
          lockedUntil: lockingNow ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      });
      await logActivity({
        action: lockingNow ? "account_locked" : "login_failed",
        module: "Admin",
        label: admin.name,
        description: lockingNow
          ? `${admin.name}'s account was locked after ${MAX_FAILED_ATTEMPTS} failed login attempts`
          : `Failed login attempt for ${admin.name}`,
      });
      if (lockingNow) {
        const alert = buildSecurityAlertEmail({
          name: admin.name,
          title: "Account locked",
          message: `Your IT Manager Portal account was locked for 15 minutes after ${MAX_FAILED_ATTEMPTS} failed sign-in attempts.`,
        });
        await sendMail({ to: admin.email, ...alert, context: { adminId: admin.id, label: admin.name } });
        return { success: false, error: `Too many failed attempts. This account is locked for 15 minutes.` };
      }
    }
    return { success: false, error: "Invalid email/username or password." };
  }

  await resetRateLimit(rateLimitKey);

  // This portal is single-admin with no second login step by design: go
  // straight to a full session on a correct password, regardless of any
  // stored twoFactorEnabled flag (see also beginTwoFactorEnrollment, which
  // refuses new enrollment for the same reason).
  await startFullSession(admin, rememberMe, "password");
  return { success: true };
}

export interface VerifyTwoFactorResult {
  success: boolean;
  error?: string;
}

export async function verifyTwoFactorLogin(input: VerifyTwoFactorInput): Promise<VerifyTwoFactorResult> {
  const parsed = verifyTwoFactorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Enter the 6-digit code from your authenticator app." };
  }

  const pending = await getPending2FASession();
  if (!pending) {
    return { success: false, error: "Your sign-in session expired. Please log in again." };
  }

  const admin = await prisma.admin.findUnique({ where: { id: pending.adminId } });
  if (!admin || !admin.twoFactorEnabled) {
    await destroyPending2FACookie();
    return { success: false, error: "Two-factor authentication is not available for this account." };
  }

  const code = parsed.data.code.trim();
  let verified = false;
  let method: LoginMethod = "password";
  const isSixDigit = /^\d{6}$/.test(code);

  if (isSixDigit) {
    verified = await verifyLoginOtp(admin.id, code);
    if (verified) method = "email_otp";
  }

  if (!verified && isSixDigit && admin.twoFactorSecret && admin.twoFactorSecretIv && admin.twoFactorSecretAuthTag) {
    verified = verifyTotpCode(
      { ciphertext: admin.twoFactorSecret, iv: admin.twoFactorSecretIv, authTag: admin.twoFactorSecretAuthTag },
      admin.email,
      code
    );
  }

  if (!verified && !isSixDigit) {
    const result = await consumeRecoveryCode(admin.twoFactorRecoveryCodes, code);
    if (result.matched) {
      verified = true;
      method = "recovery_code";
      await prisma.admin.update({ where: { id: admin.id }, data: { twoFactorRecoveryCodes: result.remainingJson } });
    }
  }

  if (!verified) {
    await logActivity({ action: "two_factor_failed", module: "Admin", label: admin.name, description: `${admin.name} entered an invalid two-factor code` });
    return { success: false, error: "That code isn't valid. Please try again." };
  }

  await destroyPending2FACookie();
  await startFullSession(admin, pending.rememberMe, method);
  return { success: true };
}

export interface SendLoginOtpResult {
  success: boolean;
  error?: string;
}

/** Sends a one-time login code to the account's email — the "email me a code instead" option on the 2FA verification screen. */
export async function sendLoginOtpAction(): Promise<SendLoginOtpResult> {
  const pending = await getPending2FASession();
  if (!pending) {
    return { success: false, error: "Your sign-in session expired. Please log in again." };
  }

  const admin = await prisma.admin.findUnique({ where: { id: pending.adminId } });
  if (!admin || !admin.twoFactorEnabled) {
    return { success: false, error: "Two-factor authentication is not available for this account." };
  }

  const otp = await createLoginOtp(admin.id);
  if (!otp.code) {
    return { success: false, error: otp.error ?? "Couldn't generate a code right now." };
  }

  const email = buildLoginOtpEmail({ name: admin.name, code: otp.code, expiresInMinutes: LOGIN_OTP_TTL_MINUTES });
  const result = await sendMail({ to: admin.email, ...email, context: { adminId: admin.id, label: admin.name } });

  if (!result.success) {
    return { success: false, error: result.error ?? "Couldn't send that email right now." };
  }

  return { success: true };
}

export async function logout(): Promise<void> {
  const admin = await getCurrentAdmin();
  const session = await getSession();

  if (session?.sessionId) {
    await prisma.session.updateMany({
      where: { id: session.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (admin) {
    await logActivity({ action: "logout", module: "Admin", label: admin.name, description: `${admin.name} signed out` });
  }

  await destroySessionCookie();
  redirect("/login");
}

async function getBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export interface ForgotPasswordResult {
  success: boolean;
  error?: string;
  /** Development-only fallback when local email delivery is unavailable. Never returned in production. */
  devResetUrl?: string;
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email address." };
  }
  const email = parsed.data.email.toLowerCase();

  const ip = await getClientIp();
  const rateLimit = await checkRateLimit(`reset:${ip}:${email}`);
  if (!rateLimit.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const admin = await prisma.admin.findUnique({ where: { email } });

  // Always return a generic success so this endpoint can't be used to enumerate accounts.
  if (!admin) {
    return { success: true };
  }

  const token = await createPasswordResetToken(admin.id);
  const resetUrl = `${await getBaseUrl()}/reset-password?token=${token}`;

  await logActivity({
    action: "password_reset_requested",
    module: "Admin",
    label: admin.name,
    description: `Password reset requested for ${admin.email}`,
  });

  const resetEmail = buildPasswordResetEmail({ name: admin.name, resetUrl });
  const result = await sendMail({ to: admin.email, ...resetEmail, context: { adminId: admin.id, label: admin.name } });

  if (!result.success) {
    if (process.env.NODE_ENV !== "production") {
      // Keep local development usable without SMTP. Production must never
      // return or log a bearer reset token to an unauthenticated caller.
      console.warn(`[mail fallback] Password reset link for ${admin.email}: ${resetUrl}`);
      return { success: true, devResetUrl: resetUrl };
    }

    console.error(`[mail] Password reset email delivery failed for admin ${admin.id}`);
  }

  return { success: true };
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const record = await findValidResetToken(parsed.data.token);
  if (!record) {
    return { success: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const admin = await prisma.admin.update({
    where: { id: record.adminId },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });
  await markResetTokenUsed(record.id);

  await prisma.activityLog.create({
    data: {
      action: "password_reset_completed",
      entityType: "Admin",
      entityLabel: admin.name,
      description: `${admin.name} completed a password reset`,
      adminId: admin.id,
    },
  });

  const alert = buildSecurityAlertEmail({
    name: admin.name,
    title: "Password reset completed",
    message: "Your IT Manager Portal password was just reset. You've been signed out of every other device.",
  });
  await sendMail({ to: admin.email, ...alert, context: { adminId: admin.id, label: admin.name } });

  return { success: true };
}
