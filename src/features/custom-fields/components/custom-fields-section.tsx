"use client";

import { Label } from "@/components/ui/label";
import { DynamicFieldInput } from "@/features/custom-fields/components/dynamic-field-input";
import type { CustomFieldDef, CustomFieldValues } from "@/lib/custom-fields/types";

interface CustomFieldsSectionProps {
  defs: CustomFieldDef[];
  values: CustomFieldValues;
  onChange: (key: string, value: CustomFieldValues[string]) => void;
}

/** Renders every visible custom field for a module inside a record form. Empty when the admin hasn't defined any yet. */
export function CustomFieldsSection({ defs, values, onChange }: CustomFieldsSectionProps) {
  const visible = defs.filter((d) => !d.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {visible.map((def) => (
        <div key={def.id} className={def.fieldType === "TEXTAREA" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
          <Label htmlFor={`cf-${def.key}`}>
            {def.label}
            {def.required && <span className="text-destructive"> *</span>}
          </Label>
          <DynamicFieldInput
            def={def}
            value={values[def.key]}
            onChange={(value) => onChange(def.key, value)}
          />
        </div>
      ))}
    </div>
  );
}
