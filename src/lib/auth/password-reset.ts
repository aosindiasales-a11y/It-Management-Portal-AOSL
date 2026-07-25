import "server-only";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const RESET_TOKEN_TTL_MINUTES = RESET_TOKEN_TTL_MS / 60_000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Generates a reset token, stores only its hash, and returns the raw token for the emailed link. Any earlier unused tokens for this admin are invalidated first. */
export async function createPasswordResetToken(adminId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { adminId, usedAt: null } });

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");

  await prisma.passwordResetToken.create({
    data: {
      adminId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return token;
}

/** Looks up an unexpired, unused token by its raw value. Returns the associated admin id, or null if invalid. */
export async function findValidResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  return record;
}

export async function markResetTokenUsed(id: string): Promise<void> {
  await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}
