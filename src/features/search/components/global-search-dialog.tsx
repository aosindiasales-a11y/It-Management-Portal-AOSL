"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedCallback } from "@/hooks/use-draft";
import { globalSearch, type SearchResult } from "@/features/search/actions";
import { MODULES, type ModuleKey } from "@/config/modules";

export function GlobalSearchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const runSearch = useDebouncedCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    globalSearch(q).then((r) => {
      setResults(r);
      setLoading(false);
    });
  }, 200);

  function handleQueryChange(q: string) {
    setQuery(q);
    setLoading(q.trim().length >= 2);
    runSearch(q);
  }

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(`${MODULES[result.module].href}?open=${result.id}`);
  }

  const grouped = React.useMemo(() => {
    const map = new Map<ModuleKey, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.module) ?? [];
      list.push(r);
      map.set(r.module, list);
    }
    return map;
  }, [results]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-secondary/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary md:flex"
      >
        <Search className="h-4 w-4" />
        Search everything…
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search employees, systems, credentials, tasks…" value={query} onValueChange={handleQueryChange} />
        <CommandList>
          {query.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>No results for &quot;{query}&quot;.</CommandEmpty>
          ) : (
            Array.from(grouped.entries()).map(([moduleKey, items]) => {
              const config = MODULES[moduleKey];
              return (
                <CommandGroup key={moduleKey} heading={config.label}>
                  {items.map((item) => (
                    <CommandItem key={`${item.module}-${item.id}`} value={`${item.module}-${item.id}`} onSelect={() => handleSelect(item)}>
                      <config.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
