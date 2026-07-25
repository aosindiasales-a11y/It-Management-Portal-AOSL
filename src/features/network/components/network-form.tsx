"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dices, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Category, NetworkConfig, Tag } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { generatePasswordClientSide } from "@/lib/generate-password";
import { networkSchema, NETWORK_DEFAULTS, type NetworkFormValues } from "@/features/network/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createNetworkConfig, revealWifiPassword, updateNetworkConfig } from "@/features/network/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface NetworkFormProps {
  config?: NetworkConfig | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

export function NetworkForm({ config, initialTagIds = [], categories, allTags, customFieldDefs, onSuccess }: NetworkFormProps) {
  const isEditing = !!config;
  const draft = useDraft<NetworkFormValues>(`network:${config?.id ?? "new"}`);
  const [showPassword, setShowPassword] = React.useState(false);

  const defaultValues: NetworkFormValues = config
    ? {
        label: config.label,
        wifiName: config.wifiName ?? "",
        wifiPassword: "",
        routerIp: config.routerIp ?? "",
        gateway: config.gateway ?? "",
        dns: config.dns ?? "",
        isp: config.isp ?? "",
        bandwidth: config.bandwidth ?? "",
        routerLoginUser: config.routerLoginUser ?? "",
        routerLoginPass: config.routerLoginPass ?? "",
        categoryId: config.categoryId,
        notes: config.notes ?? "",
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(config.customFields),
      }
    : draft.readDraft() ?? NETWORK_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<NetworkFormValues>({ resolver: zodResolver(networkSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: NetworkFormValues) {
    try {
      if (isEditing) {
        await updateNetworkConfig(config.id, values);
        toast.success("Network config updated");
      } else {
        await createNetworkConfig(values);
        toast.success("Network config added");
        draft.clearDraft();
      }
      onSuccess();
    } catch {
      toast.error("Couldn't save this network config.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="label">Label</Label>
          <Input id="label" {...register("label")} placeholder="Head Office, Branch Office…" autoFocus />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wifiName">WiFi name (SSID)</Label>
          <Input id="wifiName" {...register("wifiName")} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="wifiPassword">{isEditing ? "New WiFi password" : "WiFi password"}</Label>
            {isEditing && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Current: <RevealableSecret onReveal={() => revealWifiPassword(config.id)} />
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              id="wifiPassword"
              type={showPassword ? "text" : "password"}
              {...register("wifiPassword")}
              placeholder={isEditing ? "Leave blank to keep current" : ""}
              className="pr-20"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setValue("wifiPassword", generatePasswordClientSide(16))} aria-label="Generate password">
                <Dices className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle visibility">
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="isp">ISP</Label>
          <Input id="isp" {...register("isp")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bandwidth">Bandwidth</Label>
          <Input id="bandwidth" {...register("bandwidth")} placeholder="300 Mbps" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="routerIp">Router IP</Label>
          <Input id="routerIp" {...register("routerIp")} placeholder="192.168.1.1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gateway">Gateway</Label>
          <Input id="gateway" {...register("gateway")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dns">DNS</Label>
          <Input id="dns" {...register("dns")} placeholder="1.1.1.1, 8.8.8.8" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="routerLoginUser">Router login username</Label>
          <Input id="routerLoginUser" {...register("routerLoginUser")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="routerLoginPass">Router login password</Label>
          <Input id="routerLoginPass" type="password" {...register("routerLoginPass")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="network" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Save changes" : "Add network config"}
        </Button>
      </div>
    </form>
  );
}
