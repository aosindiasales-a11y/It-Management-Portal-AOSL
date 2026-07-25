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

  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
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
  });

  // "Log out of all devices" bumps sessionVersion — any JWT signed before
  // that (i.e. every other browser's cookie) stops resolving to an admin.
  if (!admin || admin.sessionVersion !== session.sessionVersion) return null;

  return admin;
});

/** Use at the top of protected Server Components when middleware isn't enough on its own. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
