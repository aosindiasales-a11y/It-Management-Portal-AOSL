"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, File, FileImage, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import type { Attachment } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { deleteAttachment, uploadAttachment } from "@/features/attachments/actions";
import type { ModuleKey } from "@/config/modules";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/config/uploads";

function iconFor(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentsPanelProps {
  module: ModuleKey;
  recordId: string;
  attachments: Attachment[];
  onChanged?: () => void;
}

export function AttachmentsPanel({ module, recordId, attachments, onChanged }: AttachmentsPanelProps) {
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Attachment | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter((file) => {
      if (file.size <= MAX_UPLOAD_SIZE_BYTES) return true;
      toast.error(`${file.name} is larger than ${MAX_UPLOAD_SIZE_MB} MB`);
      return false;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    let uploadedCount = 0;
    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await uploadAttachment(module, recordId, formData);
        if (!result.success) {
          toast.error(result.error ?? `Couldn't upload ${file.name}`);
        } else {
          uploadedCount += 1;
        }
      }
      if (uploadedCount > 0) {
        toast.success(uploadedCount === 1 ? "Uploaded" : `${uploadedCount} files uploaded`);
        onChanged?.();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-primary bg-accent/60" : "border-border hover:bg-accent/40"
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-sm text-foreground">Drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">Images, PDFs, ZIPs, drivers — up to {MAX_UPLOAD_SIZE_MB} MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
      </div>

      {attachments.length === 0 ? (
        <EmptyState icon={File} title="No attachments yet" description="Invoices, warranty cards, screenshots and manuals can all live here." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {attachments.map((att) => {
            const Icon = iconFor(att.mimeType);
            return (
              <li key={att.id} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{att.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(att.fileSize)}</p>
                </div>
                <Button variant="ghost" size="icon" asChild>
                  <a href={`/api/files/${att.id}`} target="_blank" rel="noopener noreferrer" download={att.fileName} aria-label={`Download ${att.fileName}`}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(att)}
                  aria-label={`Delete ${att.fileName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.fileName}"?`}
        confirmLabel="Delete file"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteAttachment(deleteTarget.id);
          toast.success("Attachment deleted");
          setDeleteTarget(null);
          onChanged?.();
        }}
      />
    </div>
  );
}
