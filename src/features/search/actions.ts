"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import type { ModuleKey } from "@/config/modules";

export interface SearchResult {
  module: ModuleKey;
  id: string;
  title: string;
  subtitle?: string;
}

const PER_MODULE_LIMIT = 5;

/** One query, fanned out across every module — the engine behind Cmd+K. */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const [employees, systems, credentials, software, network, documents, notes, tasks, vpnCredentials, tagMatches] =
    await Promise.all([
      prisma.employee.findMany({
        where: {
          archivedAt: null,
          OR: [{ name: { contains: q } }, { email: { contains: q } }, { department: { contains: q } }],
        },
        take: PER_MODULE_LIMIT,
      }),
      prisma.system.findMany({
        where: {
          archivedAt: null,
          OR: [{ name: { contains: q } }, { assetId: { contains: q } }, { serialNumber: { contains: q } }],
        },
        take: PER_MODULE_LIMIT,
      }),
      prisma.credential.findMany({
        where: {
          archivedAt: null,
          OR: [{ platform: { contains: q } }, { username: { contains: q } }, { url: { contains: q } }],
        },
        take: PER_MODULE_LIMIT,
      }),
      prisma.software.findMany({
        where: { archivedAt: null, name: { contains: q } },
        take: PER_MODULE_LIMIT,
      }),
      prisma.networkConfig.findMany({
        where: { archivedAt: null, OR: [{ label: { contains: q } }, { wifiName: { contains: q } }] },
        take: PER_MODULE_LIMIT,
      }),
      prisma.document.findMany({
        where: { archivedAt: null, OR: [{ title: { contains: q } }, { fileName: { contains: q } }] },
        take: PER_MODULE_LIMIT,
      }),
      prisma.note.findMany({
        where: { archivedAt: null, OR: [{ title: { contains: q } }, { content: { contains: q } }] },
        take: PER_MODULE_LIMIT,
      }),
      prisma.task.findMany({
        where: { archivedAt: null, title: { contains: q } },
        take: PER_MODULE_LIMIT,
      }),
      prisma.vpnCredential.findMany({
        where: {
          archivedAt: null,
          OR: [{ name: { contains: q } }, { username: { contains: q } }, { mailId: { contains: q } }],
        },
        take: PER_MODULE_LIMIT,
      }),
      prisma.tag.findMany({
        where: { name: { contains: q } },
        include: { assignments: { take: PER_MODULE_LIMIT } },
      }),
    ]);

  const results: SearchResult[] = [
    ...employees.map((e) => ({ module: "employees" as const, id: e.id, title: e.name, subtitle: e.department })),
    ...systems.map((s) => ({ module: "systems" as const, id: s.id, title: s.name, subtitle: s.assetId })),
    ...credentials.map((c) => ({ module: "credentials" as const, id: c.id, title: c.platform, subtitle: c.username ?? c.url ?? undefined })),
    ...software.map((s) => ({ module: "software" as const, id: s.id, title: s.name, subtitle: s.version ?? undefined })),
    ...network.map((n) => ({ module: "network" as const, id: n.id, title: n.label, subtitle: n.wifiName ?? undefined })),
    ...documents.map((d) => ({ module: "documents" as const, id: d.id, title: d.title, subtitle: d.fileName })),
    ...notes.map((n) => ({ module: "notes" as const, id: n.id, title: n.title, subtitle: "Note" })),
    ...tasks.map((t) => ({ module: "tasks" as const, id: t.id, title: t.title, subtitle: "Task" })),
    ...vpnCredentials.map((v) => ({ module: "vpn" as const, id: v.id, title: v.name, subtitle: v.username ?? v.mailId ?? undefined })),
  ];

  // Tag matches: surface which records carry a matching tag, deduped against results already found by name.
  const seen = new Set(results.map((r) => `${r.module}:${r.id}`));
  for (const tag of tagMatches) {
    for (const assignment of tag.assignments) {
      const key = `${assignment.module}:${assignment.recordId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        module: assignment.module as ModuleKey,
        id: assignment.recordId,
        title: `Tagged “${tag.name}”`,
        subtitle: assignment.module,
      });
    }
  }

  return results;
}
