export type DatabaseRuntimeConfig =
  | {
      mode: "local";
      url: string;
    }
  | {
      mode: "turso";
      url: string;
      authToken: string;
    };

function readEnvironmentVariable(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Resolve and validate the database configuration used by the running app.
 *
 * Prisma CLI commands continue to use DATABASE_URL from schema.prisma. The
 * deployed app switches to Turso only when both Turso variables are present.
 */
export function getDatabaseRuntimeConfig(): DatabaseRuntimeConfig {
  const tursoUrl = readEnvironmentVariable("TURSO_DATABASE_URL");
  const tursoAuthToken = readEnvironmentVariable("TURSO_AUTH_TOKEN");

  if (Boolean(tursoUrl) !== Boolean(tursoAuthToken)) {
    throw new Error(
      "Incomplete Turso database configuration. Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  if (tursoUrl && tursoAuthToken) {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(tursoUrl);
    } catch {
      throw new Error(
        "Invalid TURSO_DATABASE_URL. Expected a valid libsql:// URL.",
      );
    }

    if (parsedUrl.protocol !== "libsql:" || !parsedUrl.hostname) {
      throw new Error(
        "Invalid TURSO_DATABASE_URL. Expected a remote libsql:// URL.",
      );
    }

    return {
      mode: "turso",
      url: tursoUrl,
      authToken: tursoAuthToken,
    };
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "Turso is required on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  const localUrl = readEnvironmentVariable("DATABASE_URL");

  if (!localUrl) {
    throw new Error(
      "Database configuration is missing. Set DATABASE_URL for local SQLite, or both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for Turso.",
    );
  }

  if (!localUrl.startsWith("file:")) {
    throw new Error(
      "Invalid DATABASE_URL for local development. Expected a file: SQLite URL; configure Turso with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  return { mode: "local", url: localUrl };
}

/**
 * Shared remote-mode predicate for code paths whose behavior differs when the
 * database is hosted by Turso (for example, local database-file backups).
 */
export function isRemoteDatabaseConfigured(): boolean {
  return getDatabaseRuntimeConfig().mode === "turso";
}
