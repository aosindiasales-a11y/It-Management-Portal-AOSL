import "server-only";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";

export const LOGIN_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const LOGIN_OTP_TTL_MINUTES = LOGIN_OTP_TTL_MS / 60_000;

const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface CreateLoginOtpResult {
  code: string | null;
  error?: string;
}

/** Generates a fresh 6-digit login code for this admin, invalidating any earlier unused one. Rate-limited (per admin, persisted) to stop OTP-request flooding. */
export async function createLoginOtp(adminId: string): Promise<CreateLoginOtpResult> {
  const recent = await prisma.loginOtp.findMany({
    where: { adminId, createdAt: { gte: new Date(Date.now() - SEND_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
  });

  const mostRecent = recent[0];
  if (mostRecent) {
    const msSinceLast = Date.now() - mostRecent.createdAt.getTime();
    if (msSinceLast < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - msSinceLast) / 1000);
      return { code: null, error: `Please wait ${waitSec}s before requesting another code.` };
    }
  }

  if (recent.length >= MAX_SENDS_PER_WINDOW) {
    return { code: null, error: "Too many codes requested. Please try again in a few minutes." };
  }

  await prisma.loginOtp.deleteMany({ where: { adminId, usedAt: null } });

  const code = generateCode();
  await prisma.loginOtp.create({
    data: { adminId, codeHash: hashCode(code), expiresAt: new Date(Date.now() + LOGIN_OTP_TTL_MS) },
  });

  return { code };
}

/** Checks `code` against the admin's current unused, unexpired OTP and consumes it on a match — a code can never be used twice. */
export async function verifyLoginOtp(adminId: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  const record = await prisma.loginOtp.findFirst({
    where: { adminId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.codeHash !== hashCode(code)) return false;

  await prisma.loginOtp.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}
