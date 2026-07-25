import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import type { ActivityLog } from "@prisma/client";

import { EmptyState } from "@/components/shared/empty-state";

export function RecordTimeline({ activity }: { activity: ActivityLog[] }) {
  if (activity.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Changes to this record will show up here." />;
  }

  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {activity.map((log) => (
        <li key={log.id} className="relative">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
          <p className="text-sm text-foreground">{log.description ?? log.action}</p>
          <p className="text-xs text-muted-foreground">{formatDistanceToNow(log.createdAt, { addSuffix: true })}</p>
        </li>
      ))}
    </ol>
  );
}
