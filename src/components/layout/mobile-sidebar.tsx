"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

export function MobileSidebar({ pendingTasksCount }: { pendingTasksCount: number }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <SheetContent side="left" className="bg-brand-gradient w-72 p-0 border-none">
        <VisuallyHidden>
          <SheetTitle>Navigation menu</SheetTitle>
        </VisuallyHidden>
        <SidebarContent pendingTasksCount={pendingTasksCount} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
