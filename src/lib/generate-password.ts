/** Browser-side strong password generator (Web Crypto) — instant, no server round trip. */
export function generatePasswordClientSide(length = 20): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i]! % charset.length];
  }
  return out;
}
