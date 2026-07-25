import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

import { encrypt, decrypt, type EncryptedPayload } from "@/lib/security/encryption";

const ISSUER = "IT Manager Portal";

function buildTotp(secret: OTPAuth.Secret, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({ issuer: ISSUER, label, secret, algorithm: "SHA1", digits: 6, period: 30 });
}

/** New random TOTP secret plus the encrypted payload to persist and the QR/otpauth URI for enrollment. */
export async function generateTotpEnrollment(accountLabel: string) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = buildTotp(secret, accountLabel);
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

  return {
    encrypted: encrypt(secret.base32),
    base32: secret.base32,
    uri,
    qrDataUrl,
  };
}

/** Verifies a 6-digit code against the admin's decrypted, encrypted-at-rest secret. Allows ±1 time step for clock drift. */
export function verifyTotpCode(encryptedSecret: EncryptedPayload, accountLabel: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const base32 = decrypt(encryptedSecret);
  const totp = buildTotp(OTPAuth.Secret.fromBase32(base32), accountLabel);
  return totp.validate({ token: code, window: 1 }) !== null;
}
