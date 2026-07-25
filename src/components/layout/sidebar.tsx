import { SidebarContent } from "@/components/layout/sidebar-content";

export function Sidebar({ pendingTasksCount }: { pendingTasksCount: number }) {
  return (
    <aside className="bg-brand-gradient hidden w-64 shrink-0 border-r border-sidebar-border lg:flex lg:flex-col">
      <SidebarContent pendingTasksCount={pendingTasksCount} />
    </aside>
  );
}
