import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth/dal";

/**
 * Streams a full JSON export of portal records. Streaming keeps larger exports
 * out of Vercel's buffered Function response path and avoids holding every
 * table in memory at once.
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sections: Array<[string, () => Promise<unknown>]> = [
    ["employees", () => prisma.employee.findMany()],
    ["systems", () => prisma.system.findMany()],
    ["systemHistory", () => prisma.systemHistoryEntry.findMany()],
    ["allocationHistory", () => prisma.allocationHistory.findMany()],
    ["credentials", () => prisma.credential.findMany()],
    ["software", () => prisma.software.findMany()],
    ["softwareInstallations", () => prisma.softwareInstallation.findMany()],
    ["network", () => prisma.networkConfig.findMany()],
    ["documents", () => prisma.document.findMany()],
    ["notes", () => prisma.note.findMany()],
    ["tasks", () => prisma.task.findMany()],
    ["categories", () => prisma.category.findMany()],
    ["tags", () => prisma.tag.findMany()],
    ["tagAssignments", () => prisma.tagAssignment.findMany()],
    ["customFieldDefinitions", () => prisma.customFieldDefinition.findMany()],
    ["recordNotes", () => prisma.recordNote.findMany()],
    ["attachments", () => prisma.attachment.findMany()],
    ["activityLogs", () => prisma.activityLog.findMany()],
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (value: string) => controller.enqueue(encoder.encode(value));

      try {
        write(`{\n  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n  "version": 3,\n  "data": {`);

        for (const [index, [name, load]] of sections.entries()) {
          const records = await load();
          write(`${index === 0 ? "" : ","}\n    ${JSON.stringify(name)}: ${JSON.stringify(records)}`);
        }

        write("\n  }\n}\n");
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="it-manager-portal-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
