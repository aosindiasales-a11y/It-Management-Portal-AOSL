"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Employee } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

function employeeLabel(employee: Employee): string {
  return employee.employeeId ? `${employee.employeeId} — ${employee.name}` : employee.name;
}

interface EmployeePickerProps {
  employees: Employee[];
  value: string | null;
  onChange: (employeeId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Searchable single-select for "Allocated Person" — search by Employee ID or name, never a free-text field, so an asset can never point at a non-existent employee. */
export function EmployeePicker({ employees, value, onChange, placeholder = "Unassigned", disabled }: EmployeePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = employees.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selected ? employeeLabel(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(value2, search) => (value2.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search by Employee ID or name…" />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Unassigned
              </CommandItem>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employeeLabel(employee)}
                  onSelect={() => {
                    onChange(employee.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === employee.id ? "opacity-100" : "opacity-0")} />
                  {employeeLabel(employee)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
