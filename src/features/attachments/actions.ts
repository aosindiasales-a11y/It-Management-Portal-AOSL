"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import {
  deleteUploadedFile,
  finalizeClientBlobUpload,
  saveUploadedFile,
  FileTooLargeError,
  InvalidUploadedFileError,
  type SavedFile,
} from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { MODULES, type ModuleKey } from "@/config/modules";

export async function listAttachments(module: ModuleKey, recordId: string) {
  await requireAdmin();
  return prisma.attachment.findMany({
    where: { module, recordId },
    orderBy: { uploadedAt: "desc" },
  });
}

export interface UploadAttachmentResult {
  success: boolean;
  error?: string;
}

export async function uploadAttachment(
  module: ModuleKey,
  recordId: string,
  formData: FormData
): Promise<UploadAttachmentResult> {
  await requireAdmin();
  const file = formData.get("file");
  const blobPath = formData.get("blobPath");
  const blobFileName = formData.get("blobFileName");
  const isClientBlobUpload = typeof blobPath === "string" && typeof blobFileName === "string";

  if (!isClientBlobUpload && (!(file instanceof File) || file.size === 0)) {
    return { success: false, error: "No file selected." };
  }

  let saved: SavedFile | undefined;
  let attachmentCreated = false;
  try {
    saved = isClientBlobUpload
      ? await finalizeClientBlobUpload(module, recordId, blobPath, blobFileName)
      : await saveUploadedFile(module, recordId, file as File);

    await prisma.attachment.create({
      data: {
        module,
        recordId,
        fileName: saved.fileName,
        filePath: saved.filePath,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
      },
    });
    attachmentCreated = true;

    await logActivity({
      action: "updated",
      module,
      recordId,
      description: `Attached "${saved.fileName}"`,
    });

    revalidatePath(MODULES[module].href);
    return { success: true };
  } catch (err) {
    if (isClientBlobUpload && saved && !attachmentCreated) {
      await deleteUploadedFile(saved.filePath);
    }
    if (err instanceof FileTooLargeError) {
      return { success: false, error: err.message };
    }
    if (err instanceof InvalidUploadedFileError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Upload failed. Please try again." };
  }
}

export async function deleteAttachment(id: string) {
  await requireAdmin();
  const attachment = await prisma.attachment.delete({ where: { id } });
  await deleteUploadedFile(attachment.filePath);

  await logActivity({
    action: "updated",
    module: attachment.module as ModuleKey,
    recordId: attachment.recordId,
    description: `Removed attachment "${attachment.fileName}"`,
  });

  revalidatePath(MODULES[attachment.module as ModuleKey]?.href ?? "/dashboard");
}
