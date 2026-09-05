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

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Constructed lazily behind a Proxy, not at module load. Next.js's build-time
 * "collecting page data" step imports every route module (including ones
 * that only reach `prisma` transitively, e.g. via requireAdmin) just to
 * inspect their exports — it never calls the handlers. An eager client here
 * would read env vars and throw during that import, failing the build even
 * for routes that would never run a query in that pass.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
