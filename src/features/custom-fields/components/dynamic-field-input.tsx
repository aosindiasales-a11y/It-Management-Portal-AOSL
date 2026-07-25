"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldDef, CustomFieldValue } from "@/lib/custom-fields/types";

interface DynamicFieldInputProps {
  def: CustomFieldDef;
  value: CustomFieldValue;
  onChange: (value: CustomFieldValue) => void;
}

/** Renders the right input for a custom field's type — the piece that makes admin-defined fields actually editable. */
export function DynamicFieldInput({ def, value, onChange }: DynamicFieldInputProps) {
  const id = `cf-${def.key}`;

  switch (def.fieldType) {
    case "TEXTAREA":
      return (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      );

    case "NUMBER":
      return (
        <Input
          id={id}
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );

    case "DATE":
      return (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "CHECKBOX":
      return (
        <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <span className="text-sm text-muted-foreground">Yes</span>
        </label>
      );

    case "DROPDOWN":
      return (
        <Select value={(value as string) ?? undefined} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "EMAIL":
      return (
        <Input
          id={id}
          type="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "PHONE":
      return (
        <Input
          id={id}
          type="tel"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "URL":
      return (
        <Input
          id={id}
          type="url"
          placeholder="https://"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "PASSWORD":
      return (
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "TAG":
      return <TagListInput value={(value as string[]) ?? []} onChange={onChange} />;

    case "TEXT":
    default:
      return (
        <Input
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function TagListInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");

  function addChip() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map((chip) => (
        <Badge key={chip} variant="secondary" className="gap-1 pr-1">
          {chip}
          <button
            type="button"
            onClick={() => onChange(value.filter((c) => c !== chip))}
            className="rounded-full p-0.5 hover:bg-background/60"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addChip();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={addChip}
        placeholder={value.length === 0 ? "Type and press Enter…" : ""}
        className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
