"use client";

import * as React from "react";
import { Search } from "lucide-react";

/**
 * Search input shell for the topbar. Wired up to a real cross-module query
 * (Employees, Systems, Credentials, Documents, Notes, Software) in the
 * Search phase — for now it's keyboard-accessible chrome so the layout is
 * final and only the data layer changes later.
 */
export function GlobalSearch() {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative hidden w-full max-w-sm md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search everything…"
        className="h-9 w-full rounded-lg border border-input bg-secondary/60 pl-9 pr-14 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </div>
  );
}
