import Link from "next/link";
import { FileUp, KeyRound, ListPlus, Monitor, StickyNote, UserPlus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIONS = [
  { label: "Add Employee", href: "/employees", icon: UserPlus },
  { label: "Register System", href: "/systems", icon: Monitor },
  { label: "Add Credential", href: "/credentials", icon: KeyRound },
  { label: "Create Task", href: "/tasks", icon: ListPlus },
  { label: "Upload Document", href: "/documents", icon: FileUp },
  { label: "New Note", href: "/notes", icon: StickyNote },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-border px-3 py-4 text-center transition-all hover:border-primary/30 hover:bg-accent/60 hover:shadow-soft"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                <action.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-foreground">{action.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
