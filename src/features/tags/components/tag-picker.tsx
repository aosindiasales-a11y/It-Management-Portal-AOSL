"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Tags as TagsIcon, X } from "lucide-react";
import { toast } from "sonner";
import type { Tag } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createTag } from "@/features/tags/actions";

interface TagPickerProps {
  allTags: Tag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
}

export function TagPicker({ allTags, value, onChange }: TagPickerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selected = allTags.filter((t) => value.includes(t.id));
  const filtered = allTags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const tag = await createTag({ name });
      onChange([...value, tag.id]);
      setQuery("");
      router.refresh();
    } catch {
      toast.error("Couldn't create that tag.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((tag) => (
          <Badge key={tag.id} variant="outline" className="gap-1 border" style={{ borderColor: `${tag.color}55`, color: tag.color }}>
            {tag.name}
            <button type="button" onClick={() => toggle(tag.id)} className="rounded-full hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-6 gap-1 rounded-full px-2 text-xs">
              <Plus className="h-3 w-3" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Search or create…" value={query} onValueChange={setQuery} />
              <CommandList>
                {filtered.length === 0 && !query && (
                  <CommandEmpty className="flex flex-col items-center gap-1 py-6">
                    <TagsIcon className="h-4 w-4 text-muted-foreground" />
                    No tags yet
                  </CommandEmpty>
                )}
                <CommandGroup>
                  {filtered.map((tag) => (
                    <CommandItem key={tag.id} value={tag.id} onSelect={() => toggle(tag.id)}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                      {value.includes(tag.id) && <Check className="ml-auto h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {query.trim() && !exactMatch && (
                  <CommandGroup>
                    <CommandItem onSelect={handleCreate} disabled={creating}>
                      <Plus className="h-4 w-4" />
                      Create &quot;{query.trim()}&quot;
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
