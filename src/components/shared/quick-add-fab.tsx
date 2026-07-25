"use client";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export function QuickAddFab({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95 sm:bottom-8 sm:right-8",
        className
      )}
    >
      <Plus className="h-5 w-5" />
      {label}
      <kbd className="hidden h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-primary-foreground/15 px-1 text-[10px] font-medium sm:flex">
        C
      </kbd>
    </button>
  );
}
