"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHotkey } from "@/hooks/use-hotkey";

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["⌘", "K"], description: "Open global search" },
  { keys: ["C"], description: "Create a new record on the current page" },
  { keys: ["Esc"], description: "Close the open panel or dialog" },
  { keys: ["?"], description: "Show this shortcuts list" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Mounted once in the portal layout — "?" opens a quick reference of every keyboard shortcut in the app. */
export function ShortcutsDialog() {
  const [open, setOpen] = React.useState(false);

  useHotkey("?", () => setOpen((o) => !o));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster without touching the mouse.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
