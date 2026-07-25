import { NextResponse } from "next/server";
import { readFile } from "fs/promises";

import { getSession } from "@/lib/auth/session";
import { getDatabaseFilePath } from "@/lib/backup";

/** Streams the live SQLite database file — the "Download SQLite database" action in Settings. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const buffer = await readFile(getDatabaseFilePath());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="it-manager-portal-${new Date().toISOString().slice(0, 10)}.db"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Database file not found" }, { status: 404 });
  }
}
