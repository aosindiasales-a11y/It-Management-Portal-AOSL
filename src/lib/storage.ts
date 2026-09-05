import "server-only";

import crypto from "crypto";
import { copyFile, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { copy, del, get, head, put } from "@vercel/blob";

import type { ModuleKey } from "@/config/modules";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/config/uploads";

/**
 * Local development keeps files under <project root>/storage/uploads. Vercel
 * deployments use the project's private Blob store because a Function's local
 * filesystem is ephemeral. The database stores the same kind of opaque,
 * provider-relative pathname in both modes.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

export type FileStorageMode = "local" | "blob";

export class FileTooLargeError extends Error {}
export class InvalidUploadedFileError extends Error {}

export interface SavedFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StoredFileContent {
  body: ArrayBuffer | ReadableStream<Uint8Array>;
  contentType?: string;
  size?: number;
}

/** Local/self-hosted installs use disk; Vercel always uses private Blob. */
export function getFileStorageMode(): FileStorageMode {
  return process.env.VERCEL === "1" ? "blob" : "local";
}

function blobPrefix(module: ModuleKey, recordId: string): string {
  if (!recordId || recordId.length > 128 || recordId.includes("/") || recordId.includes("\\")) {
    throw new InvalidUploadedFileError("Invalid upload target.");
  }
  return `${module}/${recordId}/`;
}

/** Used by the upload-token route and by finalizing Server Actions. */
export function isExpectedBlobPath(module: ModuleKey, recordId: string, pathname: string): boolean {
  try {
    const prefix = blobPrefix(module, recordId);
    return pathname.startsWith(prefix) && pathname.length > prefix.length && !pathname.includes("\\");
  } catch {
    return false;
  }
}

function safeExtension(fileName: string): string {
  const extension = path.extname(fileName);
  return /^\.[a-zA-Z0-9]{1,16}$/.test(extension) ? extension.toLowerCase() : "";
}

function safeOriginalName(fileName: string): string {
  const name = path.posix.basename(path.win32.basename(fileName.replaceAll("\0", ""))).trim();
  if (!name) throw new InvalidUploadedFileError("Invalid file name.");
  return name.slice(0, 512);
}

function assertFileSize(fileName: string, size: number): void {
  if (size > MAX_UPLOAD_SIZE_BYTES) {
    throw new FileTooLargeError(`${fileName} is larger than ${MAX_UPLOAD_SIZE_MB} MB`);
  }
}

export async function saveUploadedFile(
  module: ModuleKey,
  recordId: string,
  file: File
): Promise<SavedFile> {
  assertFileSize(file.name, file.size);

  if (getFileStorageMode() === "blob") {
    const fileName = safeOriginalName(file.name);
    const diskName = `${crypto.randomBytes(16).toString("hex")}${safeExtension(fileName)}`;
    const blob = await put(`${blobPrefix(module, recordId)}${diskName}`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type || "application/octet-stream",
    });

    return {
      filePath: blob.pathname,
      fileName,
      fileSize: file.size,
      mimeType: blob.contentType || file.type || "application/octet-stream",
    };
  }

  const dir = path.join(UPLOAD_ROOT, module, recordId);
  await mkdir(dir, { recursive: true });

  const extension = path.extname(file.name);
  const diskName = `${crypto.randomBytes(8).toString("hex")}${extension}`;
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

/**
 * Claims a browser-to-Blob upload after verifying it belongs to the expected
 * record and re-reading its authoritative size/type from the private store.
 */
export async function finalizeClientBlobUpload(
  module: ModuleKey,
  recordId: string,
  pathname: string,
  originalFileName: string
): Promise<SavedFile> {
  if (getFileStorageMode() !== "blob") {
    throw new InvalidUploadedFileError("Direct Blob uploads are only available on Vercel.");
  }
  if (!isExpectedBlobPath(module, recordId, pathname)) {
    throw new InvalidUploadedFileError("The uploaded file does not match this record.");
  }

  const fileName = safeOriginalName(originalFileName);
  const blob = await head(pathname);
  if (blob.pathname !== pathname) {
    throw new InvalidUploadedFileError("The uploaded file could not be verified.");
  }

  try {
    assertFileSize(fileName, blob.size);
  } catch (error) {
    await del(pathname).catch(() => undefined);
    throw error;
  }

  return {
    filePath: blob.pathname,
    fileName,
    fileSize: blob.size,
    mimeType: blob.contentType || "application/octet-stream",
  };
}

/** Physically copies a stored file so deleting either database record never affects the other. */
export async function copyStoredFile(
  module: ModuleKey,
  sourceRelativePath: string,
  newRecordId: string
): Promise<string> {
  if (getFileStorageMode() === "blob") {
    const extension = safeExtension(sourceRelativePath);
    const diskName = `${crypto.randomBytes(16).toString("hex")}${extension}`;
    const blob = await copy(sourceRelativePath, `${blobPrefix(module, newRecordId)}${diskName}`, {
      access: "private",
      addRandomSuffix: true,
    });
    return blob.pathname;
  }

  const sourceAbsolute = resolveUploadPath(sourceRelativePath);
  const extension = path.extname(sourceRelativePath);
  const dir = path.join(UPLOAD_ROOT, module, newRecordId);
  await mkdir(dir, { recursive: true });
  const diskName = `${crypto.randomBytes(8).toString("hex")}${extension}`;
  const destAbsolute = path.join(dir, diskName);
  await copyFile(sourceAbsolute, destAbsolute);
  return path.join(module, newRecordId, diskName);
}

export async function deleteUploadedFile(storedPath: string): Promise<void> {
  if (!storedPath) return;

  if (getFileStorageMode() === "blob") {
    await del(storedPath).catch(() => undefined);
    return;
  }

  try {
    await unlink(resolveUploadPath(storedPath));
  } catch {
    // Already gone — fine, we still want the database row removed.
  }
}

export async function readUploadedFile(storedPath: string): Promise<StoredFileContent | null> {
  if (!storedPath) return null;

  if (getFileStorageMode() === "blob") {
    const result = await get(storedPath, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      body: result.stream,
      contentType: result.blob.contentType ?? undefined,
      size: result.blob.size ?? undefined,
    };
  }

  try {
    const buffer = await readFile(resolveUploadPath(storedPath));
    const body = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(body).set(buffer);
    return { body, size: buffer.byteLength };
  } catch {
    return null;
  }
}

export function resolveUploadPath(relativePath: string): string {
  const absolutePath = path.resolve(UPLOAD_ROOT, relativePath);
  const relativeToRoot = path.relative(UPLOAD_ROOT, absolutePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid file path");
  }
  return absolutePath;
}
