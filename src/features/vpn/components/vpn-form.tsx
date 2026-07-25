"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dices, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Category, VpnCredential } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { generatePasswordClientSide } from "@/lib/generate-password";
import { vpnSchema, VPN_DEFAULTS, VPN_STATUSES, VPN_ACCOUNT_TYPES, type VpnFormValues } from "@/features/vpn/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createVpnCredential, revealVpnPassword, updateVpnCredential } from "@/features/vpn/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface VpnFormProps {
  vpn?: VpnCredential | null;
  categories: Category[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function VpnForm({ vpn, categories, customFieldDefs, onSuccess, onCancel }: VpnFormProps) {
  const isEditing = !!vpn;
  const draft = useDraft<VpnFormValues>(`vpn:${vpn?.id ?? "new"}`);
  const [showPassword, setShowPassword] = React.useState(false);

  const defaultValues: VpnFormValues = vpn
    ? {
        name: vpn.name,
        username: vpn.username ?? "",
        password: "",
        mailId: vpn.mailId ?? "",
        status: (vpn.status as VpnFormValues["status"]) ?? "Enabled",
        active: vpn.active,
        accountType: (vpn.accountType as VpnFormValues["accountType"]) ?? "Standard",
        categoryId: vpn.categoryId,
        customFields: normalizeCustomFields(vpn.customFields),
      }
    : draft.readDraft() ?? VPN_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<VpnFormValues>({ resolver: zodResolver(vpnSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: VpnFormValues) {
    try {
      if (isEditing) {
        await updateVpnCredential(vpn.id, values);
        toast.success("VPN credential updated");
      } else {
        await createVpnCredential(values);
        toast.success("VPN credential added");
        draft.clearDraft();
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save this VPN credential. Check the form and try again.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const status = watch("status");
  const active = watch("active");
  const accountType = watch("accountType");
  const customFields = watch("customFields");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} placeholder="Full name" autoFocus />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input id="username" {...register("username")} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{isEditing ? "New password" : "Password"}</Label>
          {isEditing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Current: <RevealableSecret onReveal={() => revealVpnPassword(vpn.id)} />
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
        {!isEditing && <p className="text-xs text-muted-foreground">Required for a new VPN credential.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mailId">Mail ID</Label>
        <Input id="mailId" type="email" {...register("mailId")} placeholder="name@company.com" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setValue("status", v as VpnFormValues["status"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VPN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Account Type</Label>
          <Select value={accountType} onValueChange={(v) => setValue("accountType", v as VpnFormValues["accountType"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VPN_ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5">
        <span className="text-sm font-medium text-foreground">Active</span>
        <Switch checked={active} onCheckedChange={(v) => setValue("active", v)} />
      </label>

      <Separator />

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Additional</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategoryPicker module="vpn" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
          </div>
          {customFieldDefs.length > 0 && (
            <CustomFieldsSection
              defs={customFieldDefs}
              values={customFields}
              onChange={(key, value) => setValue("customFields", { ...customFields, [key]: value })}
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}
