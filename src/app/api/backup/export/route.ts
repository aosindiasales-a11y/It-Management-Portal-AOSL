import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

/** Full JSON export of every module's data — human-inspectable, for records/compliance, not a restore mechanism (use the SQLite download for that). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    employees,
    systems,
    systemHistory,
    allocationHistory,
    credentials,
    software,
    softwareInstallations,
    network,
    documents,
    notes,
    tasks,
    categories,
    tags,
    tagAssignments,
    customFieldDefinitions,
    recordNotes,
    attachments,
    activityLogs,
  ] = await Promise.all([
    prisma.employee.findMany(),
    prisma.system.findMany(),
    prisma.systemHistoryEntry.findMany(),
    prisma.allocationHistory.findMany(),
    prisma.credential.findMany(),
    prisma.software.findMany(),
    prisma.softwareInstallation.findMany(),
    prisma.networkConfig.findMany(),
    prisma.document.findMany(),
    prisma.note.findMany(),
    prisma.task.findMany(),
    prisma.category.findMany(),
    prisma.tag.findMany(),
    prisma.tagAssignment.findMany(),
    prisma.customFieldDefinition.findMany(),
    prisma.recordNote.findMany(),
    prisma.attachment.findMany(),
    prisma.activityLog.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    data: {
      employees,
      systems,
      systemHistory,
      allocationHistory,
      credentials,
      software,
      softwareInstallations,
      network,
      documents,
      notes,
      tasks,
      categories,
      tags,
      tagAssignments,
      customFieldDefinitions,
      recordNotes,
      attachments,
      activityLogs,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="it-manager-portal-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
