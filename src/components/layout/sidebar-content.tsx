"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";

import { NAV_ITEMS } from "@/config/nav";
import { Brand } from "@/components/layout/brand";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { logout } from "@/features/auth/actions";

interface SidebarContentProps {
  pendingTasksCount: number;
  onNavigate?: () => void;
}

export function SidebarContent({ pendingTasksCount, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Brand variant="dark" size="sm" />
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badgeCount = item.badgeKey === "pendingTasks" ? pendingTasksCount : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="bg-brand-gold absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                />
              )}
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.title}</span>
              {!!badgeCount && badgeCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[11px]">
                  {badgeCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
