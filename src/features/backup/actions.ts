"use server";

import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";

import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import {
  createBackup,
  getBackupMode,
  getDatabaseFilePath,
  isValidSqliteHeader,
  listBackups,
  type BackupStatus,
} from "@/lib/backup";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/config/uploads";

export async function getBackups() {
  await requireAdmin();
  return listBackups();
}

export async function getBackupStatus(): Promise<BackupStatus> {
  await requireAdmin();
  const mode = getBackupMode();
  return {
    mode,
    backups: mode === "local-sqlite" ? await listBackups() : [],
  };
}

export async function runManualBackup() {
  await requireAdmin();
  if (getBackupMode() !== "local-sqlite") {
    throw new Error("Turso manages database backups in hosted deployments.");
  }
  const backup = await createBackup("manual");
  await logActivity({ action: "created", module: "Admin", description: `Created a manual backup (${backup.name})` });
  revalidatePath("/settings");
  return backup;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
}

/**
 * Restores the database from an uploaded .db file. A safety copy of the
 * current database is always taken first. The app must be restarted
 * afterwards for the new file to take effect (SQLite connections are
 * opened once at process start).
 */
export async function restoreFromUpload(formData: FormData): Promise<RestoreResult> {
  await requireAdmin();
  if (getBackupMode() !== "local-sqlite") {
    return {
      success: false,
      error: "Raw SQLite restore is unavailable with Turso. Restore a Turso snapshot from the provider dashboard instead.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a .db file to restore." };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { success: false, error: `${file.name} is larger than ${MAX_UPLOAD_SIZE_MB} MB` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isValidSqliteHeader(buffer)) {
    return { success: false, error: "That doesn't look like a valid SQLite database file." };
  }

  await createBackup("pre-import");
  await writeFile(getDatabaseFilePath(), buffer);

  await logActivity({ action: "restored", module: "Admin", description: "Restored the database from an uploaded backup" });
  revalidatePath("/settings");

  return { success: true };
}
