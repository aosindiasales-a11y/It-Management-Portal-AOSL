import type { Metadata } from "next";

import { getCurrentAdmin } from "@/lib/auth/dal";
import { getDashboardData } from "@/features/dashboard/lib/get-dashboard-data";
import { StatsGrid } from "@/features/dashboard/components/stats-grid";
import { SystemsStatusChart } from "@/features/dashboard/components/systems-status-chart";
import { DepartmentChart } from "@/features/dashboard/components/department-chart";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { RecentTasks } from "@/features/dashboard/components/recent-tasks";
import { QuickActions } from "@/features/dashboard/components/quick-actions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [admin, data] = await Promise.all([getCurrentAdmin(), getDashboardData()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back{admin?.name ? `, ${admin.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your IT estate today.
        </p>
      </div>

      <StatsGrid stats={data.stats} />

      <QuickActions />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SystemsStatusChart data={data.systemsByStatus} />
        <DepartmentChart data={data.employeesByDepartment} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity activity={data.recentActivity} />
        <RecentTasks tasks={data.recentTasks} />
      </div>
    </div>
  );
}
