import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { getDatabaseRuntimeConfig } from "@/lib/database-config";

/**
 * Prisma client singleton. In dev, Next.js hot-reloads modules on every
 * file save, which would otherwise create a new PrismaClient (and a new
 * SQLite connection) per reload. Caching it on `globalThis` avoids that.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const database = getDatabaseRuntimeConfig();
  const log: ("warn" | "error")[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

  if (database.mode === "turso") {
    const libsql = createClient({
      url: database.url,
      authToken: database.authToken,
    });

    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
      log,
    });
  }

  return new PrismaClient({ log });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
