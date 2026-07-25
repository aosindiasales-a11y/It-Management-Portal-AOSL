"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { copyStoredFile, deleteUploadedFile, saveUploadedFile, FileTooLargeError } from "@/lib/storage";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { buildCustomFieldsSchema } from "@/lib/custom-fields/schema";
import { setRecordTags, copyRecordTags, getRecordTagIds } from "@/features/tags/actions";
import { documentMetaSchema, type DocumentMetaValues } from "@/features/documents/schema";
import { serializeJsonValue } from "@/lib/json";

const MODULE = "documents" as const;

export async function getDocuments(includeArchived = false) {
  return prisma.document.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { uploadedAt: "desc" },
  });
}

async function validateCustomFields(values: Record<string, unknown>) {
  const defs = await getCustomFieldDefs(MODULE);
  return buildCustomFieldsSchema(defs).parse(values);
}

function parseMeta(formData: FormData): DocumentMetaValues {
  return documentMetaSchema.parse({
    title: formData.get("title"),
    categoryId: (formData.get("categoryId") as string) || null,
    notes: formData.get("notes") ?? "",
    tagIds: JSON.parse((formData.get("tagIds") as string) || "[]"),
    customFields: JSON.parse((formData.get("customFields") as string) || "{}"),
  });
}

export interface DocumentActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

export async function createDocument(formData: FormData): Promise<DocumentActionResult> {
  await requireAdmin();
  const parsed = parseMeta(formData);
  const customFields = await validateCustomFields(parsed.customFields);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please choose a file to upload." };
  }

  try {
    // Documents are keyed by their own id, so we create the row first with a
    // placeholder path, then move the file into its final id-scoped folder.
    const draftDoc = await prisma.document.create({
      data: { title: parsed.title, categoryId: parsed.categoryId || null, notes: parsed.notes || null, customFields: serializeJsonValue(customFields), fileName: file.name, filePath: "" },
    });

    const saved = await saveUploadedFile(MODULE, draftDoc.id, file);
    const document = await prisma.document.update({
      where: { id: draftDoc.id },
      data: { fileName: saved.fileName, filePath: saved.filePath, fileSize: saved.fileSize, mimeType: saved.mimeType },
    });

    await setRecordTags({ module: MODULE, recordId: document.id, tagIds: parsed.tagIds });
    await logActivity({ action: "created", module: MODULE, recordId: document.id, label: document.title, description: `Uploaded document ${document.title}` });

    revalidatePath("/documents");
    revalidatePath("/dashboard");
    return { success: true, id: document.id };
  } catch (err) {
    if (err instanceof FileTooLargeError) return { success: false, error: err.message };
    return { success: false, error: "Upload failed. Please try again." };
  }
}

export async function updateDocument(id: string, formData: FormData): Promise<DocumentActionResult> {
  await requireAdmin();
  const parsed = parseMeta(formData);
  const customFields = await validateCustomFields(parsed.customFields);

  const file = formData.get("file");
  let fileFields: Partial<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = {};

  if (file instanceof File && file.size > 0) {
    try {
      const existing = await prisma.document.findUniqueOrThrow({ where: { id } });
      const saved = await saveUploadedFile(MODULE, id, file);
      await deleteUploadedFile(existing.filePath);
      fileFields = { fileName: saved.fileName, filePath: saved.filePath, fileSize: saved.fileSize, mimeType: saved.mimeType };
    } catch (err) {
      if (err instanceof FileTooLargeError) return { success: false, error: err.message };
      return { success: false, error: "Replacing the file failed. Please try again." };
    }
  }

  const document = await prisma.document.update({
    where: { id },
    data: { title: parsed.title, categoryId: parsed.categoryId || null, notes: parsed.notes || null, customFields: serializeJsonValue(customFields), ...fileFields },
  });

  await setRecordTags({ module: MODULE, recordId: id, tagIds: parsed.tagIds });
  await logActivity({ action: "updated", module: MODULE, recordId: id, label: document.title, description: `Updated document ${document.title}` });

  revalidatePath("/documents");
  return { success: true, id: document.id };
}

export async function archiveDocument(id: string) {
  await requireAdmin();
  const document = await prisma.document.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "archived", module: MODULE, recordId: id, label: document.title, description: `Archived document ${document.title}` });
  revalidatePath("/documents");
}

export async function restoreDocument(id: string) {
  await requireAdmin();
  const document = await prisma.document.update({ where: { id }, data: { archivedAt: null } });
  await logActivity({ action: "restored", module: MODULE, recordId: id, label: document.title, description: `Restored document ${document.title}` });
  revalidatePath("/documents");
}

export async function deleteDocument(id: string) {
  await requireAdmin();
  const document = await prisma.document.delete({ where: { id } });
  await deleteUploadedFile(document.filePath);
  await logActivity({ action: "deleted", module: MODULE, label: document.title, description: `Deleted document ${document.title}` });
  revalidatePath("/documents");
}

export async function duplicateDocument(id: string) {
  await requireAdmin();
  const original = await prisma.document.findUniqueOrThrow({ where: { id } });

  const draftCopy = await prisma.document.create({
    data: {
      title: `${original.title} (Copy)`,
      categoryId: original.categoryId,
      notes: original.notes,
      customFields: original.customFields ?? undefined,
      fileName: original.fileName,
      filePath: "",
      fileSize: original.fileSize,
      mimeType: original.mimeType,
    },
  });

  // Physically duplicate the file on disk so deleting either copy never affects the other.
  const newPath = await copyStoredFile(MODULE, original.filePath, draftCopy.id);
  const copy = await prisma.document.update({ where: { id: draftCopy.id }, data: { filePath: newPath } });

  await copyRecordTags(MODULE, id, copy.id);
  await logActivity({ action: "duplicated", module: MODULE, recordId: copy.id, label: copy.title, description: `Duplicated document ${original.title}` });

  revalidatePath("/documents");
  return copy;
}

export async function getDocumentTagIds(id: string) {
  return getRecordTagIds(MODULE, id);
}
