import type { ActivityLog } from "@prisma/client";

import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Brand } from "@/components/layout/brand";
import { GlobalSearchDialog } from "@/features/search/components/global-search-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import type { ExpiryAlert } from "@/lib/notifications";

interface TopbarProps {
  pendingTasksCount: number;
  admin: {
    name: string;
    username: string;
    email: string;
    avatarUrl: string | null;
  };
  recentActivity: ActivityLog[];
  expiryAlerts: ExpiryAlert[];
}

export function Topbar({ pendingTasksCount, admin, recentActivity, expiryAlerts }: TopbarProps) {
  return (
    <header className="bg-sidebar sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4 lg:px-8">
      <MobileSidebar pendingTasksCount={pendingTasksCount} />
      <div className="flex items-center lg:hidden">
        <Brand variant="dark" size="sm" />
      </div>
      <GlobalSearchDialog />
      <div className="ml-auto flex items-center gap-1.5">
        <NotificationBell activity={recentActivity} expiryAlerts={expiryAlerts} />
        <ThemeToggle />
        <UserMenu admin={admin} />
      </div>
    </header>
  );
}
