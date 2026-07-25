import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { resolveUploadPath } from "@/lib/storage";

/**
 * Streams an uploaded file back to the (authenticated) admin. Never
 * public — every request re-checks the session, and the id is an opaque
 * Attachment/Document id, never a raw filesystem path.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  const record = attachment ?? (await prisma.document.findUnique({ where: { id } }));

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const absolutePath = resolveUploadPath(record.filePath);
    const buffer = await readFile(absolutePath);
    const fileName = "fileName" in record ? record.fileName : "download";
    const mimeType = "mimeType" in record && record.mimeType ? record.mimeType : "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }
}
