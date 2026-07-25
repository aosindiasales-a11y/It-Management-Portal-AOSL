import { formatDistanceToNow } from "date-fns";
import { Activity, LogIn, LogOut } from "lucide-react";
import type { ActivityLog } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { isModuleKey, MODULES } from "@/config/modules";

function iconFor(log: ActivityLog): LucideIcon {
  if (log.action === "logout") return LogOut;
  if (log.entityType === "Admin") return LogIn;
  if (isModuleKey(log.entityType)) return MODULES[log.entityType].icon;
  return Activity;
}

export function RecentActivity({ activity }: { activity: ActivityLog[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Latest Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Actions you take across the portal will show up here." />
        ) : (
          <ul className="space-y-5">
            {activity.map((log) => {
              const Icon = iconFor(log);
              return (
                <li key={log.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{log.description ?? log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
