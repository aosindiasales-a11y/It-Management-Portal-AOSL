"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createCategory } from "@/features/categories/actions";
import type { ModuleKey } from "@/config/modules";
import type { Category } from "@prisma/client";

interface CategoryPickerProps {
  module: ModuleKey;
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

export function CategoryPicker({ module, categories, value, onChange }: CategoryPickerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selected = categories.find((c) => c.id === value);
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const category = await createCategory({ module, name });
      onChange(category.id);
      setQuery("");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't create that category.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">No category</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or create…" value={query} onValueChange={setQuery} />
          <CommandList>
            {value && (
              <CommandItem
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Clear category
              </CommandItem>
            )}
            {filtered.length === 0 && !query && <CommandEmpty>No categories yet.</CommandEmpty>}
            <CommandGroup>
              {filtered.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.id}
                  onSelect={() => {
                    onChange(category.id);
                    setOpen(false);
                  }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                  {value === category.id && <Check className="ml-auto h-4 w-4" />}
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
  );
}
