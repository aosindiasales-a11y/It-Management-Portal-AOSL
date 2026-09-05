import { NextResponse } from "next/server";
import { readFile } from "fs/promises";

import { getCurrentAdmin } from "@/lib/auth/dal";
import { getBackupMode, getDatabaseFilePath } from "@/lib/backup";

/** Streams the live SQLite database file — the "Download SQLite database" action in Settings. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (getBackupMode() !== "local-sqlite") {
    return NextResponse.json(
      { error: "Raw database downloads are unavailable with managed Turso storage." },
      { status: 409 },
    );
  }

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
