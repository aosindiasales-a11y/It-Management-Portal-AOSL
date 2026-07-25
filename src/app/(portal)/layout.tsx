import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getRecentActivity } from "@/lib/activity";
import { getExpiryAlerts } from "@/lib/notifications";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: middleware already blocks unauthenticated requests,
  // this is the Server Component-level check per Next.js's auth guidance.
  const admin = await requireAdmin();
  const [pendingTasksCount, recentActivity, expiryAlerts] = await Promise.all([
    prisma.task.count({ where: { completed: false, archivedAt: null } }),
    getRecentActivity(6),
    getExpiryAlerts(),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar pendingTasksCount={pendingTasksCount} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar pendingTasksCount={pendingTasksCount} admin={admin} recentActivity={recentActivity} expiryAlerts={expiryAlerts} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
      <ShortcutsDialog />
    </div>
  );
}
