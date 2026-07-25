"use client";

import * as React from "react";
import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";

interface FacetOption {
  label: string;
  value: string;
  color?: string;
}

interface DataTableFacetFilterProps<TData> {
  column?: Column<TData, unknown>;
  title: string;
  options: FacetOption[];
}

/** A checklist filter popover for one table column — the "Smart Filters" building block used by every module (status, category, tags, employee). */
export function DataTableFacetFilter<TData>({ column, title, options }: DataTableFacetFilterProps<TData>) {
  const selected = new Set((column?.getFilterValue() as string[] | undefined) ?? []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle className="h-4 w-4" />
          {title}
          {selected.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1.5 text-xs font-normal">
                {selected.size}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selected);
                      if (isSelected) next.delete(option.value);
                      else next.add(option.value);
                      const arr = Array.from(next);
                      column?.setFilterValue(arr.length ? arr : undefined);
                    }}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded border border-primary"
                      style={{ backgroundColor: isSelected ? "hsl(var(--primary))" : "transparent" }}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    {option.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} />}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <Separator />
                <CommandGroup>
                  <CommandItem onSelect={() => column?.setFilterValue(undefined)} className="justify-center text-center text-muted-foreground">
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
