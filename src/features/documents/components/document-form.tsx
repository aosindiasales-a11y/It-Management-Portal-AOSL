"use client";

import * as React from "react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import type { Category, Document as DocumentRecord, Tag } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { documentMetaSchema, DOCUMENT_DEFAULTS, type DocumentMetaValues } from "@/features/documents/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createDocument, updateDocument } from "@/features/documents/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/config/uploads";

interface DocumentFormProps {
  document?: DocumentRecord | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

function blobFileExtension(fileName: string): string {
  return fileName.match(/\.[a-zA-Z0-9]{1,16}$/)?.[0].toLowerCase() ?? "";
}

async function getUploadStorage(): Promise<"local" | "blob"> {
  const response = await fetch("/api/files/upload", { cache: "no-store" });
  if (!response.ok) throw new Error("Couldn't initialize the upload.");
  const result = (await response.json()) as { storage?: unknown };
  if (result.storage !== "local" && result.storage !== "blob") {
    throw new Error("Couldn't initialize the upload.");
  }
  return result.storage;
}

export function DocumentForm({ document, initialTagIds = [], categories, allTags, customFieldDefs, onSuccess }: DocumentFormProps) {
  const isEditing = !!document;
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const defaultValues: DocumentMetaValues = document
    ? {
        title: document.title,
        categoryId: document.categoryId,
        notes: document.notes ?? "",
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(document.customFields),
      }
    : DOCUMENT_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DocumentMetaValues>({ resolver: zodResolver(documentMetaSchema), defaultValues });

  async function onSubmit(values: DocumentMetaValues) {
    if (!isEditing && (!file || file.size === 0)) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (file && file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error(`${file.name} is larger than ${MAX_UPLOAD_SIZE_MB} MB`);
      return;
    }

    const formData = new FormData();
    formData.set("title", values.title);
    formData.set("categoryId", values.categoryId ?? "");
    formData.set("notes", values.notes ?? "");
    formData.set("tagIds", JSON.stringify(values.tagIds));
    formData.set("customFields", JSON.stringify(values.customFields));

    setSubmitting(true);
    try {
      if (file && file.size > 0) {
        const storage = await getUploadStorage();
        if (storage === "blob") {
          const recordId = document?.id ?? crypto.randomUUID();
          const pathname = `documents/${recordId}/${crypto.randomUUID()}${blobFileExtension(file.name)}`;
          const blob = await uploadToBlob(pathname, file, {
            access: "private",
            contentType: file.type || "application/octet-stream",
            handleUploadUrl: "/api/files/upload",
            clientPayload: JSON.stringify({ module: "documents", recordId }),
          });
          formData.set("blobPath", blob.pathname);
          formData.set("blobFileName", file.name);
          if (!isEditing) formData.set("blobDocumentId", recordId);
        } else {
          formData.set("file", file);
        }
      }

      const result = isEditing ? await updateDocument(document.id, formData) : await createDocument(formData);
      if (!result.success) {
        toast.error(result.error ?? "Couldn't save this document.");
        return;
      }
      toast.success(isEditing ? "Document updated" : "Document uploaded");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this document.");
    } finally {
      setSubmitting(false);
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} placeholder="Dell OptiPlex Invoice" autoFocus />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>{isEditing ? "Replace file (optional)" : "File"}</Label>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-6 text-center transition-colors hover:bg-accent/40">
          {file ? <FileText className="h-5 w-5 text-muted-foreground" /> : <UploadCloud className="h-5 w-5 text-muted-foreground" />}
          <span className="text-sm text-foreground">{file ? file.name : isEditing ? document!.fileName : "Click to choose a file"}</span>
          <span className="text-xs text-muted-foreground">PDF, images, ZIP, drivers — up to {MAX_UPLOAD_SIZE_MB} MB</span>
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null;
              if (selectedFile && selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
                toast.error(`${selectedFile.name} is larger than ${MAX_UPLOAD_SIZE_MB} MB`);
                event.target.value = "";
                setFile(null);
                return;
              }
              setFile(selectedFile);
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="documents" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker allTags={allTags} value={tagIds} onChange={(v) => setValue("tagIds", v)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      {customFieldDefs.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom fields</p>
            <CustomFieldsSection
              defs={customFieldDefs}
              values={customFields}
              onChange={(key, value) => setValue("customFields", { ...customFields, [key]: value })}
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Save changes" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}
