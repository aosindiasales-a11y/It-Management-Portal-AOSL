/**
 * One-time schema migration for the Systems/Assets overhaul, applied
 * directly to the production Turso database. `prisma db push` (used for the
 * local SQLite file) can't target a libsql:// URL, and prisma/push-remote.ts
 * only emits CREATE TABLE/INDEX IF NOT EXISTS statements — it can't add
 * columns to a table that already exists. This adds exactly the new
 * columns this task introduced on `systems` and `credentials`, each guarded
 * by a check against `PRAGMA table_info`, so it's safe to run more than
 * once.
 *
 * Run with: npx tsx scripts/migrate-systems-remote.ts
 * (requires TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in the environment)
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const NEW_SYSTEM_COLUMNS: { name: string; ddl: string }[] = [
  { name: "assetType", ddl: `ALTER TABLE "systems" ADD COLUMN "assetType" TEXT` },
  { name: "keyboard", ddl: `ALTER TABLE "systems" ADD COLUMN "keyboard" TEXT` },
  { name: "mousePad", ddl: `ALTER TABLE "systems" ADD COLUMN "mousePad" TEXT` },
  { name: "charger", ddl: `ALTER TABLE "systems" ADD COLUMN "charger" TEXT` },
  { name: "credentialId", ddl: `ALTER TABLE "systems" ADD COLUMN "credentialId" TEXT` },
];

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (e.g. via `vercel env pull`).");
  }

  const client = createClient({ url, authToken });

  try {
    const existingColumns = await client.execute(`PRAGMA table_info("systems")`);
    const existingNames = new Set(existingColumns.rows.map((r) => String(r.name)));

    for (const column of NEW_SYSTEM_COLUMNS) {
      if (existingNames.has(column.name)) {
        console.log(`systems.${column.name} already exists — skipping.`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await client.execute(column.ddl);
      console.log(`Added systems.${column.name}.`);
    }

    await client.execute(`CREATE INDEX IF NOT EXISTS "systems_credentialId_idx" ON "systems"("credentialId")`);
    console.log("Ensured systems_credentialId_idx index.");

    // Default for existing rows created before this migration: the Prisma-level default only applies to new inserts.
    await client.execute(`UPDATE "systems" SET "status" = 'VACANT' WHERE "status" IS NULL`);

    const finalColumns = await client.execute(`PRAGMA table_info("systems")`);
    console.log(
      "systems columns now:",
      finalColumns.rows.map((r) => r.name).join(", ")
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
