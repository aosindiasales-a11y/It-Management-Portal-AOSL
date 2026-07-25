import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { Task } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "bg-accent text-accent-foreground",
  HIGH: "bg-warning/15 text-warning",
  URGENT: "bg-destructive/15 text-destructive",
};

export function RecentTasks({ tasks }: { tasks: Task[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Recent Tasks</CardTitle>
        <Link href="/tasks" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState icon={ListChecks} title="No pending tasks" description="Create a task to see it show up here." />
        ) : (
          <ul className="space-y-1">
            {tasks.map((task) => {
              const due = daysUntil(task.dueDate);
              const overdue = due !== null && due < 0;
              return (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                      {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
                      {overdue ? " · Overdue" : ""}
                    </p>
                  </div>
                  <Badge className={cn("shrink-0 border-0 capitalize", PRIORITY_STYLES[task.priority])}>
                    {task.priority.toLowerCase()}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
