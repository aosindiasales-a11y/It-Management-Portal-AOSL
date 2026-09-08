"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { SafeCredential } from "@/features/systems/types";

function credentialLabel(credential: SafeCredential): string {
  return credential.username ? `${credential.platform} — ${credential.username}` : credential.platform;
}

interface CredentialPickerProps {
  credentials: SafeCredential[];
  value: string | null;
  onChange: (credentialId: string | null) => void;
}

/**
 * Links a System to an existing Credential Vault entry rather than storing a
 * second, separate password on the asset itself. Only platform/username are
 * ever shown here — the encrypted password stays in the vault and is only
 * ever decrypted through the vault's own reveal action.
 */
export function CredentialPicker({ credentials, value, onChange }: CredentialPickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = credentials.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{selected ? credentialLabel(selected) : "None"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(value2, search) => (value2.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search credentials…" />
          <CommandList>
            <CommandEmpty>No credential found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                None
              </CommandItem>
              {credentials.map((credential) => (
                <CommandItem
                  key={credential.id}
                  value={credentialLabel(credential)}
                  onSelect={() => {
                    onChange(credential.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === credential.id ? "opacity-100" : "opacity-0")} />
                  {credentialLabel(credential)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
