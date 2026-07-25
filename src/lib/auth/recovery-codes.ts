import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const CODE_COUNT = 10;
const GROUP_LENGTH = 4;

function randomCode(): string {
  const bytes = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
  return `${bytes.slice(0, GROUP_LENGTH)}-${bytes.slice(GROUP_LENGTH, GROUP_LENGTH * 2)}`;
}

/** Ten fresh one-time recovery codes, plus the bcrypt-hashed form to persist as `Admin.twoFactorRecoveryCodes`. */
export async function generateRecoveryCodes(): Promise<{ plaintextCodes: string[]; hashedJson: string }> {
  const plaintextCodes = Array.from({ length: CODE_COUNT }, randomCode);
  const hashes = await Promise.all(plaintextCodes.map((code) => bcrypt.hash(code, 10)));
  return { plaintextCodes, hashedJson: JSON.stringify(hashes) };
}

/** Checks `code` against the stored hashes; if it matches, returns the remaining hashes with that one consumed. */
export async function consumeRecoveryCode(hashedJson: string | null, code: string): Promise<{ matched: boolean; remainingJson: string }> {
  const hashes: string[] = hashedJson ? JSON.parse(hashedJson) : [];
  const normalized = code.trim().toUpperCase();

  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i]!)) {
      const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
      return { matched: true, remainingJson: JSON.stringify(remaining) };
    }
  }

  return { matched: false, remainingJson: hashedJson ?? "[]" };
}

export function countRemainingRecoveryCodes(hashedJson: string | null): number {
  if (!hashedJson) return 0;
  try {
    return (JSON.parse(hashedJson) as string[]).length;
  } catch {
    return 0;
  }
}
