import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

/**
 * Data Access Layer for auth — the single choke point Server Components
 * and Server Actions call to find out who's logged in. Centralizing this
 * (rather than trusting middleware alone) follows Next.js's recommended
 * defense-in-depth pattern for protecting data.
 */

export const getCurrentAdmin = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const persistedSession = await prisma.session.findUnique({
    where: { id: session.sessionId },
    select: {
      adminId: true,
      revokedAt: true,
      admin: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatarUrl: true,
          role: true,
          lastLoginAt: true,
          sessionVersion: true,
          twoFactorEnabled: true,
        },
      },
    },
  });

  // Require the JWT to reference a live Session row owned by the same admin.
  // This makes per-session revocation effective immediately at every DAL
  // boundary instead of trusting a still-valid signed cookie until expiry.
  if (
    !persistedSession ||
    persistedSession.revokedAt ||
    persistedSession.adminId !== session.adminId ||
    persistedSession.admin.sessionVersion !== session.sessionVersion
  ) {
    return null;
  }

  return persistedSession.admin;
});

/** Use at the top of protected Server Components when middleware isn't enough on its own. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
