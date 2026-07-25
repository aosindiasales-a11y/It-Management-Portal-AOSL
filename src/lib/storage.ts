import "server-only";
import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

import type { ModuleKey } from "@/config/modules";

/**
 * Local-disk attachment storage. Files live under <project root>/storage/uploads
 * — outside `public/`, so nothing is reachable without going through the
 * authenticated /api/files/[id] route (see that route for the auth check).
 * This is the right amount of infrastructure for a single-server, on-prem
 * tool for ~20 people; swapping in S3 later only means changing this file.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — generous for invoices/drivers, not for video dumps

export class FileTooLargeError extends Error {}

export interface SavedFile {
  filePath: string; // relative to UPLOAD_ROOT — what we store in the DB
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function saveUploadedFile(
  module: ModuleKey,
  recordId: string,
  file: File
): Promise<SavedFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileTooLargeError(`${file.name} is larger than 25 MB`);
  }

  const dir = path.join(UPLOAD_ROOT, module, recordId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name);
  const safeStem = crypto.randomBytes(8).toString("hex");
  const diskName = `${safeStem}${ext}`;
  const absolutePath = path.join(dir, diskName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    filePath: path.join(module, recordId, diskName),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

/** Physically copies a stored file for a new record — used by "Duplicate" so deleting one copy never touches the other. */
export async function copyStoredFile(
  module: ModuleKey,
  sourceRelativePath: string,
  newRecordId: string
): Promise<string> {
  const sourceAbsolute = resolveUploadPath(sourceRelativePath);
  const ext = path.extname(sourceRelativePath);
  const dir = path.join(UPLOAD_ROOT, module, newRecordId);
  await mkdir(dir, { recursive: true });
  const diskName = `${crypto.randomBytes(8).toString("hex")}${ext}`;
  const destAbsolute = path.join(dir, diskName);
  await copyFile(sourceAbsolute, destAbsolute);
  return path.join(module, newRecordId, diskName);
}

export async function deleteUploadedFile(relativePath: string): Promise<void> {
  const absolutePath = path.join(UPLOAD_ROOT, relativePath);
  try {
    await unlink(absolutePath);
  } catch {
    // Already gone — fine, we still want the DB row removed.
  }
}

export function resolveUploadPath(relativePath: string): string {
  const absolutePath = path.join(UPLOAD_ROOT, relativePath);
  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid file path");
  }
  return absolutePath;
}
