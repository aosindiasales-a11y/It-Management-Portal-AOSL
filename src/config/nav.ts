import { History, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

import { MODULE_LIST } from "@/config/modules";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "pendingTasks";
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ...MODULE_LIST.map((m) => ({
    title: m.label,
    href: m.href,
    icon: m.icon,
    badgeKey: m.key === "tasks" ? ("pendingTasks" as const) : undefined,
  })),
  { title: "Audit Logs", href: "/audit-logs", icon: History },
  { title: "Settings", href: "/settings", icon: Settings },
];
