"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dices, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Category, Software, Tag } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { generatePasswordClientSide } from "@/lib/generate-password";
import { softwareSchema, SOFTWARE_DEFAULTS, type SoftwareFormValues } from "@/features/software/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createSoftware, revealSoftwarePassword, updateSoftware } from "@/features/software/actions";
import { KNOWN_LICENSES, splitLicenses } from "@/features/software/lib/license-badges";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

const STATUS_OPTIONS = ["Active", "Disabled", "Pending"];
const DEFAULT_PORTAL_URL = "https://m365.cloud.microsoft/";
// Rendered as explicit, ordered fields below instead of the generic custom-fields section.
const HANDLED_CUSTOM_KEYS = new Set(["password", "mail_id", "department", "status"]);

interface SoftwareFormProps {
  software?: Software | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

export function SoftwareForm({ software, initialTagIds = [], categories, customFieldDefs, onSuccess }: SoftwareFormProps) {
  const isEditing = !!software;
  const draft = useDraft<SoftwareFormValues>(`software:${software?.id ?? "new"}`);
  const [showPassword, setShowPassword] = React.useState(false);

  const defaultCategoryId = categories.find((c) => c.name === "Microsoft 365 User Details")?.id ?? null;

  const defaultValues: SoftwareFormValues = software
    ? (() => {
        // The stored password is an encrypted {ciphertext,iv,authTag} object, not a
        // plain custom-field value — it must never enter the form's customFields
        // state, or client-side validation silently rejects it and blocks Save.
        const { password: _encryptedPassword, ...restCustomFields } = normalizeCustomFields(software.customFields);
        return {
          name: software.name,
          version: software.version ?? "",
          licenseKey: software.licenseKey ?? "",
          licenseType: software.licenseType ?? "",
          expiryDate: software.expiryDate ? software.expiryDate.toISOString().slice(0, 10) : "",
          downloadLink: software.downloadLink ?? "",
          categoryId: software.categoryId,
          notes: software.notes ?? "",
          tagIds: initialTagIds,
          customFields: restCustomFields,
          password: "",
        };
      })()
    : draft.readDraft() ?? { ...SOFTWARE_DEFAULTS, downloadLink: DEFAULT_PORTAL_URL, categoryId: defaultCategoryId };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SoftwareFormValues>({ resolver: zodResolver(softwareSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: SoftwareFormValues) {
    try {
      if (isEditing) {
        await updateSoftware(software.id, values);
        toast.success("Microsoft 365 user updated");
      } else {
        await createSoftware(values);
        toast.success("Microsoft 365 user added");
        draft.clearDraft();
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save this user. Check the form and try again.");
    }
  }

  const licenseType = watch("licenseType") ?? "";
  const customFields = watch("customFields");
  const selectedLicenses = splitLicenses(licenseType);
  const knownSelected = selectedLicenses.filter((l) => (KNOWN_LICENSES as readonly string[]).includes(l));
  const otherLicense = selectedLicenses.find((l) => !(KNOWN_LICENSES as readonly string[]).includes(l)) ?? "";

  function toggleLicense(license: string) {
    const next = knownSelected.includes(license) ? knownSelected.filter((l) => l !== license) : [...knownSelected, license];
    setValue("licenseType", [...next, ...(otherLicense ? [otherLicense] : [])].join("+"));
  }

  function setOtherLicense(value: string) {
    setValue("licenseType", [...knownSelected, value.trim()].filter(Boolean).join("+"));
  }

  function setCustomField(key: string, value: SoftwareFormValues["customFields"][string]) {
    setValue("customFields", { ...customFields, [key]: value });
  }

  const email = typeof customFields.mail_id === "string" ? customFields.mail_id : "";
  const department = typeof customFields.department === "string" ? customFields.department : "";
  const status = typeof customFields.status === "string" && customFields.status ? customFields.status : "Active";

  const secondaryDefs = customFieldDefs.filter((d) => !HANDLED_CUSTOM_KEYS.has(d.key));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...register("name")} placeholder="Akshay Sharma" autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mail_id">Email</Label>
          <Input id="mail_id" type="email" value={email} onChange={(e) => setCustomField("mail_id", e.target.value)} placeholder="akshay@company.com" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{isEditing ? "New password" : "Password"}</Label>
          {isEditing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Current: <RevealableSecret onReveal={() => revealSoftwarePassword(software.id)} />
            </span>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            {...register("password")}
            placeholder={isEditing ? "Leave blank to keep current password" : ""}
            className="pr-20"
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setValue("password", generatePasswordClientSide())}
              aria-label="Generate password"
            >
              <Dices className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {!isEditing && <p className="text-xs text-muted-foreground">Required for a new user.</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <Input id="department" value={department} onChange={(e) => setCustomField("department", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setCustomField("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>License</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {KNOWN_LICENSES.map((license) => (
            <label key={license} className="flex items-center gap-2 text-sm">
              <Checkbox checked={knownSelected.includes(license)} onCheckedChange={() => toggleLicense(license)} />
              {license}
            </label>
          ))}
        </div>
        <Input value={otherLicense} onChange={(e) => setOtherLicense(e.target.value)} placeholder="Other license (free text)…" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="downloadLink">Microsoft Portal URL</Label>
        <Input id="downloadLink" {...register("downloadLink")} placeholder={DEFAULT_PORTAL_URL} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      {secondaryDefs.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Additional fields</p>
            <CustomFieldsSection defs={secondaryDefs} values={customFields} onChange={setCustomField} />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Save changes" : "Add Microsoft user"}
        </Button>
      </div>
    </form>
  );
}
