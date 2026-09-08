"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import type { Category, Employee, System, Tag } from "@prisma/client";
import type { SafeCredential } from "@/features/systems/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { EmployeePicker } from "@/features/systems/components/employee-picker";
import { CredentialPicker } from "@/features/systems/components/credential-picker";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { ASSET_TYPES, systemSchema, SYSTEM_DEFAULTS, SYSTEM_STATUSES, type SystemFormValues } from "@/features/systems/schema";
import { normalizeCustomFields } from "@/lib/json";
import { addSystemHistoryEntry, createSystem, updateSystem } from "@/features/systems/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

const STATUS_LABELS: Record<(typeof SYSTEM_STATUSES)[number], string> = {
  ALLOCATED: "Allocated",
  VACANT: "Vacant",
  REPAIR: "Repair",
  RETIRED: "Retired",
};

const YES_NO_LABELS: Record<"unspecified" | "Yes" | "No", string> = {
  unspecified: "Not specified",
  Yes: "Yes",
  No: "No",
};

function yesNoToSelectValue(value: "Yes" | "No" | null | undefined): "unspecified" | "Yes" | "No" {
  return value ?? "unspecified";
}

function selectValueToYesNo(value: string): "Yes" | "No" | null {
  return value === "unspecified" ? null : (value as "Yes" | "No");
}

interface SystemFormProps {
  system?: System | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  employees: Employee[];
  credentials: SafeCredential[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function SystemForm({ system, initialTagIds = [], categories, allTags, employees, credentials, customFieldDefs, onSuccess }: SystemFormProps) {
  const isEditing = !!system;
  const draft = useDraft<SystemFormValues>(`systems:${system?.id ?? "new"}`);

  const defaultValues: SystemFormValues = system
    ? {
        assetId: system.assetId,
        name: system.name,
        assetType: system.assetType ?? "",
        serialNumber: system.serialNumber ?? "",
        manufacturer: system.manufacturer ?? "",
        model: system.model ?? "",
        processor: system.processor ?? "",
        ram: system.ram ?? "",
        storage: system.storage ?? "",
        osVersion: system.osVersion ?? "",
        officeVersion: system.officeVersion ?? "",
        purchaseDate: toDateInput(system.purchaseDate),
        warrantyExpiry: toDateInput(system.warrantyExpiry),
        status: system.status as SystemFormValues["status"],
        keyboard: system.keyboard as SystemFormValues["keyboard"],
        mousePad: system.mousePad as SystemFormValues["mousePad"],
        charger: system.charger as SystemFormValues["charger"],
        categoryId: system.categoryId,
        location: system.location ?? "",
        notes: system.notes ?? "",
        assignedEmployeeId: system.assignedEmployeeId,
        credentialId: system.credentialId,
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(system.customFields),
      }
    : draft.readDraft() ?? SYSTEM_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SystemFormValues>({ resolver: zodResolver(systemSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: SystemFormValues) {
    try {
      if (isEditing) {
        await updateSystem(system.id, values);
        toast.success("System updated");
      } else {
        await createSystem(values);
        toast.success("System registered");
        draft.clearDraft();
      }
      onSuccess();
    } catch {
      toast.error("Couldn't save this system. Check the form and try again.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");
  const status = watch("status");
  const assignedEmployeeId = watch("assignedEmployeeId") ?? null;
  const credentialId = watch("credentialId") ?? null;
  const assetType = watch("assetType") || "unspecified";
  const keyboard = watch("keyboard");
  const mousePad = watch("mousePad");
  const charger = watch("charger");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">System name</Label>
          <Input id="name" {...register("name")} placeholder="Sales-WKS-01" autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assetId">Asset Code</Label>
          <Input id="assetId" {...register("assetId")} placeholder="AOSL/Asset/LAP/12" />
          {errors.assetId && <p className="text-xs text-destructive">{errors.assetId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assetType">Asset type</Label>
          <Select value={assetType} onValueChange={(v) => setValue("assetType", v === "unspecified" ? "" : v)}>
            <SelectTrigger id="assetType">
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unspecified">Not specified</SelectItem>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input id="serialNumber" {...register("serialNumber")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setValue("status", v as SystemFormValues["status"])}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="keyboard">Keyboard</Label>
          <Select value={yesNoToSelectValue(keyboard)} onValueChange={(v) => setValue("keyboard", selectValueToYesNo(v))}>
            <SelectTrigger id="keyboard">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["unspecified", "Yes", "No"] as const).map((v) => (
                <SelectItem key={v} value={v}>
                  {YES_NO_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mousePad">Mouse / Mouse Pad</Label>
          <Select value={yesNoToSelectValue(mousePad)} onValueChange={(v) => setValue("mousePad", selectValueToYesNo(v))}>
            <SelectTrigger id="mousePad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["unspecified", "Yes", "No"] as const).map((v) => (
                <SelectItem key={v} value={v}>
                  {YES_NO_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="charger">Charger</Label>
          <Select value={yesNoToSelectValue(charger)} onValueChange={(v) => setValue("charger", selectValueToYesNo(v))}>
            <SelectTrigger id="charger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["unspecified", "Yes", "No"] as const).map((v) => (
                <SelectItem key={v} value={v}>
                  {YES_NO_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" {...register("manufacturer")} placeholder="Dell, HP, Lenovo…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Model</Label>
          <Input id="model" {...register("model")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="processor">Processor</Label>
          <Input id="processor" {...register("processor")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ram">RAM</Label>
          <Input id="ram" {...register("ram")} placeholder="16 GB" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="storage">Storage</Label>
          <Input id="storage" {...register("storage")} placeholder="512 GB SSD" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="osVersion">Windows / OS version</Label>
          <Input id="osVersion" {...register("osVersion")} placeholder="Windows 11 Pro" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="officeVersion">Office version</Label>
          <Input id="officeVersion" {...register("officeVersion")} placeholder="Microsoft 365" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...register("location")} placeholder="2nd Floor — Sales" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="purchaseDate">Purchase date</Label>
          <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="warrantyExpiry">Warranty expiry</Label>
          <Input id="warrantyExpiry" type="date" {...register("warrantyExpiry")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assignedEmployeeId">Allocated person</Label>
          <EmployeePicker
            employees={employees}
            value={assignedEmployeeId}
            onChange={(v) => setValue("assignedEmployeeId", v)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Credential reference</Label>
          <CredentialPicker credentials={credentials} value={credentialId} onChange={(v) => setValue("credentialId", v)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="systems" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker allTags={allTags} value={tagIds} onChange={(v) => setValue("tagIds", v)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      {customFieldDefs.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom fields</p>
            <CustomFieldsSection
              defs={customFieldDefs}
              values={customFields}
              onChange={(key, value) => setValue("customFields", { ...customFields, [key]: value })}
            />
          </div>
        </>
      )}

      {isEditing && <QuickHistoryLogger systemId={system.id} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Save changes" : "Register system"}
        </Button>
      </div>
    </form>
  );
}

const COMMON_EVENTS = ["Windows Installed", "Office Installed", "SSD Replaced", "RAM Upgraded", "Reset Done", "Printer Connected"];

function QuickHistoryLogger({ systemId }: { systemId: string }) {
  const [open, setOpen] = React.useState(false);
  const [eventType, setEventType] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleLog() {
    if (!eventType.trim()) return;
    setSaving(true);
    try {
      await addSystemHistoryEntry(systemId, eventType, description);
      toast.success("Logged to timeline");
      setEventType("");
      setDescription("");
      setOpen(false);
    } catch {
      toast.error("Couldn't log that event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeline</p>
          {!open && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log event
            </Button>
          )}
        </div>
        {open && (
          <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-1.5">
              {COMMON_EVENTS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEventType(e)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  {e}
                </button>
              ))}
            </div>
            <Input placeholder="Event, e.g. SSD Replaced" value={eventType} onChange={(e) => setEventType(e.target.value)} />
            <Input placeholder="Details (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleLog} disabled={saving || !eventType.trim()}>
                Add to timeline
              </Button>
            </div>
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">See the full history in the Activity tab.</p>
      </div>
    </>
  );
}
