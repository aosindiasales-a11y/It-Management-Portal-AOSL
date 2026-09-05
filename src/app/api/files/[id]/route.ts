import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";

import { isModuleKey, type ModuleKey } from "@/config/modules";
import { MAX_UPLOAD_SIZE_BYTES } from "@/config/uploads";
import { getCurrentAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getFileStorageMode, isExpectedBlobPath, readUploadedFile } from "@/lib/storage";

interface ClientUploadPayload {
  module: ModuleKey;
  recordId: string;
}

function parseClientUploadPayload(value: string | null | undefined): ClientUploadPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    throw new Error("Invalid upload request.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("module" in parsed) ||
    !("recordId" in parsed) ||
    typeof parsed.module !== "string" ||
    !isModuleKey(parsed.module) ||
    typeof parsed.recordId !== "string"
  ) {
    throw new Error("Invalid upload request.");
  }

  return { module: parsed.module, recordId: parsed.recordId };
}

/**
 * Streams an uploaded file back to an authenticated admin. Blob objects stay
 * private: the storage URL and credentials are never returned to the browser.
 * The reserved `upload` id also exposes the active backend to the upload UI.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id === "upload") {
    return NextResponse.json(
      { storage: getFileStorageMode() },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  const record = attachment ?? (await prisma.document.findUnique({ where: { id } }));

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const storedFile = await readUploadedFile(record.filePath);
    if (!storedFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileName = "fileName" in record ? record.fileName : "download";
    const mimeType =
      ("mimeType" in record && record.mimeType) ||
      storedFile.contentType ||
      "application/octet-stream";
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    };
    if (storedFile.size !== undefined) headers["Content-Length"] = String(storedFile.size);

    return new NextResponse(storedFile.body, { headers });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

/**
 * Vercel Blob client-upload handshake and signed completion callback. Uploads
 * go browser-to-Blob, avoiding Vercel's 4.5 MB Function request-body limit.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "upload" || getFileStorageMode() !== "blob") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const admin = await getCurrentAdmin();
        if (!admin) throw new Error("Unauthorized");

        const upload = parseClientUploadPayload(clientPayload);
        if (!isExpectedBlobPath(upload.module, upload.recordId, pathname)) {
          throw new Error("Invalid upload destination.");
        }

        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}
