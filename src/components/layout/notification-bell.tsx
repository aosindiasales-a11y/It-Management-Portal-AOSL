"use client";

import Link from "next/link";
import type { ActivityLog } from "@prisma/client";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODULES } from "@/config/modules";
import { cn, timeAgo } from "@/lib/utils";
import type { ExpiryAlert } from "@/lib/notifications";

const RECENT_MS = 24 * 60 * 60 * 1000;

const SEVERITY_STYLES: Record<ExpiryAlert["severity"], string> = {
  overdue: "bg-destructive/15 text-destructive",
  urgent: "bg-warning/15 text-warning",
  upcoming: "bg-secondary text-secondary-foreground",
};

function severityLabel(alert: ExpiryAlert): string {
  if (alert.severity === "overdue") return `Overdue by ${Math.abs(alert.daysLeft)}d`;
  if (alert.daysLeft === 0) return "Due today";
  return `${alert.daysLeft}d left`;
}

interface NotificationBellProps {
  activity: ActivityLog[];
  expiryAlerts: ExpiryAlert[];
}

/** Recent-activity feed plus real expiry-driven alerts (warranty, license renewal) — the app's Notification Center. */
export function NotificationBell({ activity, expiryAlerts }: NotificationBellProps) {
  const hasRecentActivity = activity.some((a) => Date.now() - new Date(a.createdAt).getTime() < RECENT_MS);
  const hasUrgentAlert = expiryAlerts.some((a) => a.severity !== "upcoming");
  const hasBadge = hasRecentActivity || hasUrgentAlert;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-sidebar-foreground hover:bg-white/10 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-[1.15rem] w-[1.15rem]" />
          {hasBadge && (
            <span
              className={cn(
                "absolute right-2 top-2 h-2 w-2 rounded-full",
                hasUrgentAlert ? "bg-destructive" : "bg-brand-gold"
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {expiryAlerts.length > 0 && (
          <div className="border-b border-border">
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Expiry alerts</p>
              <p className="text-xs text-muted-foreground">Warranty and license renewals due within 30 days.</p>
            </div>
            <ul className="max-h-56 overflow-y-auto no-scrollbar">
              {expiryAlerts.map((alert) => (
                <li key={`${alert.module}-${alert.recordId}`} className="border-t border-border first:border-t-0">
                  <Link
                    href={`${MODULES[alert.module].href}?open=${alert.recordId}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{alert.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{alert.detail}</p>
                    </div>
                    <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_STYLES[alert.severity])}>
                      {severityLabel(alert)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Recent activity</p>
        </div>
        {activity.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto no-scrollbar">
            {activity.map((entry) => (
              <li key={entry.id} className="border-b border-border px-4 py-2.5 last:border-0">
                <p className="text-sm text-foreground">{entry.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard" className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent">
          View all
        </Link>
      </PopoverContent>
    </Popover>
  );
}
