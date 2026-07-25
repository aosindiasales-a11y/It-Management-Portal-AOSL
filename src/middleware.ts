import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";

/**
 * Route protection. Runs on the Edge runtime, so it can only use Web Crypto
 * (via `jose`) — not `node:crypto`. This is the first line of defense;
 * `requireAdmin()` in Server Components is the second (see
 * src/lib/auth/dal.ts and Next.js's defense-in-depth guidance for auth).
 *
 * Also performs sliding-expiry refresh: a valid session touched after
 * INACTIVITY_REFRESH_THRESHOLD_MS gets a freshly-signed cookie with a
 * renewed expiration, so the fixed-TTL JWT behaves like an inactivity
 * timeout instead of a hard cutoff from login time.
 */

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "itmp_session";
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify-2fa"];

const DEFAULT_SESSION_MS = 1000 * 60 * 60 * 12;
const REMEMBER_ME_SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const INACTIVITY_REFRESH_THRESHOLD_MS = 1000 * 60 * 5;

interface SessionClaims {
  adminId: string;
  username: string;
  sessionVersion: number;
  rememberMe: boolean;
  sessionId: string;
  iat: number;
}

function getSecretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

async function verify(token: string, key: Uint8Array): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    if (
      typeof payload.adminId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.iat !== "number"
    ) {
      return null;
    }
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

async function reissue(claims: SessionClaims, key: Uint8Array): Promise<{ token: string; maxAgeSec: number }> {
  const maxAgeMs = claims.rememberMe ? REMEMBER_ME_SESSION_MS : DEFAULT_SESSION_MS;
  const token = await new SignJWT({
    adminId: claims.adminId,
    username: claims.username,
    sessionVersion: claims.sessionVersion,
    rememberMe: claims.rememberMe,
    sessionId: claims.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + maxAgeMs) / 1000))
    .sign(key);

  return { token, maxAgeSec: Math.floor(maxAgeMs / 1000) };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const key = getSecretKey();
  const claims = token && key ? await verify(token, key) : null;
  const authed = claims !== null;

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!authed && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authed && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();

  if (authed && claims && key) {
    const idleMs = Date.now() - claims.iat * 1000;
    if (idleMs > INACTIVITY_REFRESH_THRESHOLD_MS) {
      const { token: freshToken, maxAgeSec } = await reissue(claims, key);
      response.cookies.set(SESSION_COOKIE_NAME, freshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeSec,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api/auth (login/logout must be reachable while logged out)
     * - _next/static, _next/image (Next internals)
     * - favicon.ico and other static assets
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
