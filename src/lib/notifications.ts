import "server-only";

import { prisma } from "@/lib/prisma";

export interface ExpiryAlert {
  module: "systems" | "software";
  recordId: string;
  label: string;
  detail: string;
  dueDate: Date;
  daysLeft: number;
  severity: "overdue" | "urgent" | "upcoming";
}

const LOOKAHEAD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function severityFor(daysLeft: number): ExpiryAlert["severity"] {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "urgent";
  return "upcoming";
}

function toAlert(module: ExpiryAlert["module"], recordId: string, label: string, detail: string, dueDate: Date, now: Date): ExpiryAlert {
  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / MS_PER_DAY);
  return { module, recordId, label, detail, dueDate, daysLeft, severity: severityFor(daysLeft) };
}

/** Warranty and license expiries due within 30 days (including already-overdue ones) — powers the Notification Center and the Dashboard. */
export async function getExpiryAlerts(): Promise<ExpiryAlert[]> {
  const now = new Date();
  const threshold = new Date(now.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY);

  const [systems, software] = await Promise.all([
    prisma.system.findMany({
      where: { archivedAt: null, warrantyExpiry: { not: null, lte: threshold } },
      select: { id: true, name: true, assetId: true, warrantyExpiry: true },
      orderBy: { warrantyExpiry: "asc" },
    }),
    prisma.software.findMany({
      where: { archivedAt: null, expiryDate: { not: null, lte: threshold } },
      select: { id: true, name: true, expiryDate: true },
      orderBy: { expiryDate: "asc" },
    }),
  ]);

  const alerts: ExpiryAlert[] = [
    ...systems.map((s) => toAlert("systems", s.id, s.name, `Warranty · ${s.assetId}`, s.warrantyExpiry!, now)),
    ...software.map((s) => toAlert("software", s.id, s.name, "License renewal", s.expiryDate!, now)),
  ];

  return alerts.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
