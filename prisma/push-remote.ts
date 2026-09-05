/**
 * Applies the Prisma schema to the remote Turso database.
 *
 * The Prisma CLI (`prisma db push` / `prisma migrate`) talks to the
 * `datasource` in schema.prisma, which is a local `file:` SQLite URL — it
 * cannot reach a libsql:// database. So this script does the equivalent in
 * two steps: ask the Prisma CLI to render the schema as plain SQL, then
 * execute that SQL over the libSQL client the app already depends on.
 *
 * It is deliberately additive and non-destructive: every CREATE is rewritten
 * to `IF NOT EXISTS`, so re-running it against an already-provisioned
 * database is a no-op and never drops a table or its rows. It does NOT
 * migrate an existing database to a changed schema — that still needs a
 * hand-written migration.
 *
 * Run with: npm run db:push:remote
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@libsql/client";

import { getDatabaseRuntimeConfig } from "../src/lib/database-config";

function renderSchemaAsSql(): string {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

  return execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      schemaPath,
      "--script",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
}

/** Makes the generated script safe to replay against a populated database. */
function makeIdempotent(sql: string): string {
  return sql
    .replace(/CREATE TABLE (?!IF NOT EXISTS)/g, "CREATE TABLE IF NOT EXISTS ")
    .replace(/CREATE UNIQUE INDEX (?!IF NOT EXISTS)/g, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/CREATE INDEX (?!IF NOT EXISTS)/g, "CREATE INDEX IF NOT EXISTS ");
}

async function main() {
  const database = getDatabaseRuntimeConfig();

  if (database.mode !== "turso") {
    throw new Error(
      "No remote database configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, " +
        "or use `npm run db:push` for the local SQLite file.",
    );
  }

  const sql = makeIdempotent(renderSchemaAsSql());
  const client = createClient({ url: database.url, authToken: database.authToken });

  try {
    await client.executeMultiple(sql);

    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'",
    );
    console.log(`Schema applied to Turso. ${tables.rows.length} tables present.`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
