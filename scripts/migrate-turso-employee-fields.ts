/**
 * One-off migration: adds the `employeeId` and `dateOfBirth` columns to the
 * `employees` table on the remote Turso production database.
 *
 * `npm run db:push:remote` can't do this — it renders schema.prisma as
 * `CREATE TABLE IF NOT EXISTS`, which is a no-op against a table that
 * already exists (see prisma/push-remote.ts). Adding a column to an
 * existing table needs a hand-written ALTER TABLE, which is what this does.
 *
 * Safety:
 *  - Both columns are added nullable — no existing row is touched, and
 *    nothing here can fail or drop data because of it.
 *  - Checks `PRAGMA table_info` first and skips any ALTER whose column
 *    already exists, so re-running this is a safe no-op.
 *  - Only ever touches the `employees` table.
 *  - Verifies the row count is unchanged before/after as a final check.
 *
 * Run with: npx tsx scripts/migrate-turso-employee-fields.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

import { getDatabaseRuntimeConfig } from "../src/lib/database-config";

async function main() {
  const database = getDatabaseRuntimeConfig();
  if (database.mode !== "turso") {
    throw new Error("No remote database configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  }

  const client = createClient({ url: database.url, authToken: database.authToken });

  try {
    const before = await client.execute("SELECT COUNT(*) as count FROM employees");
    const beforeCount = Number(before.rows[0]?.count ?? 0);
    console.log(`employees table currently has ${beforeCount} row(s).`);

    const columns = await client.execute("PRAGMA table_info(employees)");
    const existing = new Set(columns.rows.map((row) => String(row.name)));

    if (!existing.has("dateOfBirth")) {
      console.log('Adding column "dateOfBirth"...');
      await client.execute('ALTER TABLE "employees" ADD COLUMN "dateOfBirth" DATETIME');
    } else {
      console.log('"dateOfBirth" already exists, skipping.');
    }

    if (!existing.has("employeeId")) {
      console.log('Adding column "employeeId"...');
      await client.execute('ALTER TABLE "employees" ADD COLUMN "employeeId" TEXT');
    } else {
      console.log('"employeeId" already exists, skipping.');
    }

    console.log('Ensuring unique index on "employeeId"...');
    await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS "employees_employeeId_key" ON "employees"("employeeId")');

    const after = await client.execute("SELECT COUNT(*) as count FROM employees");
    const afterCount = Number(after.rows[0]?.count ?? 0);
    console.log(`employees table now has ${afterCount} row(s).`);

    if (afterCount !== beforeCount) {
      throw new Error(`Row count changed unexpectedly (${beforeCount} -> ${afterCount}). Investigate before proceeding.`);
    }

    const finalColumns = await client.execute("PRAGMA table_info(employees)");
    console.log(
      "Final employees columns:",
      finalColumns.rows.map((r) => r.name).join(", ")
    );

    console.log("Migration complete — no rows were added, removed, or modified.");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
