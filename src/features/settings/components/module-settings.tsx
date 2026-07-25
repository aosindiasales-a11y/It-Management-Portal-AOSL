"use client";

import * as React from "react";
import type { Category } from "@prisma/client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldManager } from "@/features/custom-fields/components/custom-field-manager";
import { CategoryManager } from "@/features/categories/components/category-manager";
import { MODULE_LIST, type ModuleKey } from "@/config/modules";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface ModuleSettingsProps {
  fieldsByModule: Record<ModuleKey, CustomFieldDef[]>;
  categoriesByModule: Record<ModuleKey, Category[]>;
}

export function ModuleSettings({ fieldsByModule, categoriesByModule }: ModuleSettingsProps) {
  const [module, setModule] = React.useState<ModuleKey>(MODULE_LIST[0]!.key);
  const config = MODULE_LIST.find((m) => m.key === module)!;

  return (
    <div className="space-y-6">
      <div className="max-w-xs space-y-1.5">
        <Select value={module} onValueChange={(v) => setModule(v as ModuleKey)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULE_LIST.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom fields</CardTitle>
          <CardDescription>Add fields specific to {config.label.toLowerCase()} — they show up on every form for this module.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomFieldManager module={module} defs={fieldsByModule[module]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Group {config.label.toLowerCase()} records the way you think about them.</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryManager module={module} categories={categoriesByModule[module]} />
        </CardContent>
      </Card>
    </div>
  );
}
