import type { Credential } from "@prisma/client";

/**
 * Credential shape safe to send to the client for the "Credential reference"
 * picker and "View Credential" dialog — strips encryptedPassword/iv/authTag
 * so no ciphertext ever leaves the server for a plain asset list/edit view.
 * The actual password is only ever fetched via revealCredentialPassword(),
 * which is called explicitly and separately from an admin-gated action.
 */
export type SafeCredential = Omit<Credential, "encryptedPassword" | "iv" | "authTag">;

export function toSafeCredential(credential: Credential): SafeCredential {
  const { encryptedPassword: _encryptedPassword, iv: _iv, authTag: _authTag, ...safe } = credential;
  return safe;
}
