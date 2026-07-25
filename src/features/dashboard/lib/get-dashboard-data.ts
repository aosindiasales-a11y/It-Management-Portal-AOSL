import "server-only";

import { prisma } from "@/lib/prisma";
import { getRecentActivity } from "@/lib/activity";

const WARRANTY_LOOKAHEAD_DAYS = 30;

export async function getDashboardData() {
  const now = new Date();
  const warrantyThreshold = new Date(now.getTime() + WARRANTY_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalEmployees,
    totalSystems,
    totalCredentials,
    pendingTasks,
    warrantyExpiringSoon,
    totalDocuments,
    systemsByStatus,
    employeesByDepartment,
    recentActivity,
    recentTasks,
  ] = await Promise.all([
    prisma.employee.count({ where: { archivedAt: null } }),
    prisma.system.count({ where: { archivedAt: null } }),
    prisma.credential.count({ where: { archivedAt: null } }),
    prisma.task.count({ where: { completed: false, archivedAt: null } }),
    prisma.system.count({
      where: { archivedAt: null, warrantyExpiry: { not: null, lte: warrantyThreshold } },
    }),
    prisma.document.count({ where: { archivedAt: null } }),
    prisma.system.groupBy({ by: ["status"], where: { archivedAt: null }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["department"], where: { archivedAt: null }, _count: { _all: true } }),
    getRecentActivity(6),
    prisma.task.findMany({
      where: { completed: false, archivedAt: null },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
    }),
  ]);

  return {
    stats: {
      totalEmployees,
      totalSystems,
      totalCredentials,
      pendingTasks,
      warrantyExpiringSoon,
      totalDocuments,
    },
    systemsByStatus: systemsByStatus.map((s) => ({
      status: s.status,
      count: s._count._all,
    })),
    employeesByDepartment: employeesByDepartment.map((d) => ({
      department: d.department,
      count: d._count._all,
    })),
    recentActivity,
    recentTasks,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
