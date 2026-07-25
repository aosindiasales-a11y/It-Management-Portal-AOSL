import crypto from "crypto";

/**
 * AES-256-GCM helpers for the Credential Vault (Module 4) and any other
 * field that must never be stored as plaintext (e.g. WiFi passwords).
 *
 * Node-only — do not import this from middleware.ts or any file that runs
 * on the Edge runtime, since `node:crypto` isn't available there.
 *
 * ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one
 * with: openssl rand -hex 32
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set. Add a 64-character hex string or any passphrase to your .env file.");
  }

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/** Encrypts plaintext, returning base64 ciphertext plus the IV/auth tag needed to decrypt it. */
export function encrypt(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/** Reverses `encrypt`. Throws if the auth tag doesn't match (tampered or wrong key). */
export function decrypt(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Generates a strong random password for the Credential Vault's "Generate Password" action. */
export function generatePassword(length = 20): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i]! % charset.length];
  }
  return out;
}
