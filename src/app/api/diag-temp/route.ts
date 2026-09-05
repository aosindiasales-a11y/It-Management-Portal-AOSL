import { NextResponse } from "next/server";

/** Temporary diagnostic route — reports which required env vars are present at runtime (never their values). Removed once the investigation is done. */
export async function GET() {
  const names = [
    "AUTH_SECRET",
    "ENCRYPTION_KEY",
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "DATABASE_URL",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD_HASH",
    "BLOB_READ_WRITE_TOKEN",
    "SESSION_COOKIE_NAME",
    "VERCEL",
    "VERCEL_ENV",
  ];
  const presence = Object.fromEntries(names.map((n) => [n, Boolean(process.env[n]?.length)]));
  return NextResponse.json(presence);
}
