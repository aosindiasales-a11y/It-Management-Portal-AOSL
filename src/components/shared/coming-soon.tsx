import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Placeholder for modules landing in a later phase — keeps sidebar navigation fully wired. */
export function ComingSoon({ icon, title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <EmptyState
        icon={icon}
        title={`${title} is coming soon`}
        description="This module is planned for an upcoming phase of the IT Manager Portal build."
      />
    </div>
  );
}
