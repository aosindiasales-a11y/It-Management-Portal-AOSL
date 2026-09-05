import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Session handling built on signed, encrypted-at-rest-by-HTTPS JWT cookies
 * via `jose` (Web Crypto based, so it also works inside middleware.ts on
 * the Edge runtime — unlike Node's built-in `crypto`).
 *
 * The architecture is deliberately "one admin today, more tomorrow": the
 * payload carries an `adminId`, so promoting this to multi-user auth later
 * is just changing where the id comes from, not the session mechanism.
 */

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "itmp_session";
export const PENDING_2FA_COOKIE_NAME = "itmp_2fa_pending";

const DEFAULT_SESSION_MS = 1000 * 60 * 60 * 12; // 12 hours
const REMEMBER_ME_SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const PENDING_2FA_MS = 1000 * 60 * 10; // 10 minutes to complete the 2FA step
/** How long a session can go untouched before sliding-refresh stops renewing it — the practical "inactivity timeout". */
export const INACTIVITY_REFRESH_THRESHOLD_MS = 1000 * 60 * 5;

export interface SessionPayload {
  adminId: string;
  username: string;
  sessionVersion: number;
  rememberMe: boolean;
  /** Correlates this JWT to its `Session` row (see prisma schema) — used for the Active Sessions list and "log out of all devices". */
  sessionId: string;
  [key: string]: unknown;
}

export interface Pending2FAPayload {
  adminId: string;
  rememberMe: boolean;
  [key: string]: unknown;
}

/** What callers provide to start a session — `rememberMe` is supplied separately since it also controls cookie maxAge. */
export interface NewSessionInput {
  adminId: string;
  username: string;
  sessionVersion: number;
  sessionId: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Add a long random string to your .env file.");
  }
  return new TextEncoder().encode(secret);
}

function maxAgeForRememberMe(rememberMe: boolean): number {
  return rememberMe ? REMEMBER_ME_SESSION_MS : DEFAULT_SESSION_MS;
}

export async function signSession(payload: SessionPayload, maxAgeMs: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + maxAgeMs) / 1000))
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.adminId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      typeof payload.rememberMe !== "boolean" ||
      typeof payload.sessionId !== "string"
    ) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Creates the session cookie after a successful login (or 2FA verification). Call from a Server Action or Route Handler. */
export async function createSessionCookie(payload: NewSessionInput, rememberMe: boolean): Promise<void> {
  const maxAgeMs = maxAgeForRememberMe(rememberMe);
  const token = await signSession({ ...payload, rememberMe }, maxAgeMs);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

export async function destroySessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Re-signs the current device's own cookie with a new sessionVersion — keeps this device logged in when bumping the version to invalidate every other one. */
export async function reissueSessionCookie(sessionVersion: number): Promise<void> {
  const current = await getSession();
  if (!current) return;
  await createSessionCookie(
    { adminId: current.adminId, username: current.username, sessionVersion, sessionId: current.sessionId },
    current.rememberMe
  );
}

/** Reads and verifies the current session from Server Components / Actions / Route Handlers. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Re-signs the session with a fresh expiration, sliding the absolute cutoff
 * forward on activity — this is what turns a fixed-TTL JWT into an
 * inactivity timeout (an idle browser's cookie simply expires on schedule).
 * Edge-safe: only uses `jose`, callable from middleware.
 */
export async function refreshSession(payload: SessionPayload): Promise<string> {
  const maxAgeMs = maxAgeForRememberMe(payload.rememberMe);
  return signSession(payload, maxAgeMs);
}

// ── Pending 2FA cookie — the short-lived bridge between "password verified"
// and "TOTP/recovery code verified" while the session cookie is withheld. ──

export async function createPending2FACookie(payload: Pending2FAPayload): Promise<void> {
  const token = await new SignJWT({ ...payload, purpose: "2fa-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + PENDING_2FA_MS) / 1000))
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(PENDING_2FA_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(PENDING_2FA_MS / 1000),
  });
}

export async function getPending2FASession(): Promise<Pending2FAPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_2FA_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "2fa-pending" || typeof payload.adminId !== "string") return null;
    return payload as unknown as Pending2FAPayload;
  } catch {
    return null;
  }
}

export async function destroyPending2FACookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_2FA_COOKIE_NAME);
}
