"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dices, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Category, Credential, Tag } from "@prisma/client";

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
import { credentialSchema, CREDENTIAL_DEFAULTS, type CredentialFormValues } from "@/features/credentials/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createCredential, revealCredentialPassword, updateCredential } from "@/features/credentials/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface CredentialFormProps {
  credential?: Credential | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

export function CredentialForm({ credential, initialTagIds = [], categories, allTags, customFieldDefs, onSuccess }: CredentialFormProps) {
  const isEditing = !!credential;
  const draft = useDraft<CredentialFormValues>(`credentials:${credential?.id ?? "new"}`);
  const [showPassword, setShowPassword] = React.useState(false);

  const defaultValues: CredentialFormValues = credential
    ? {
        platform: credential.platform,
        url: credential.url ?? "",
        username: credential.username ?? "",
        password: "",
        categoryId: credential.categoryId,
        notes: credential.notes ?? "",
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(credential.customFields),
      }
    : draft.readDraft() ?? CREDENTIAL_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CredentialFormValues>({ resolver: zodResolver(credentialSchema), defaultValues });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: CredentialFormValues) {
    try {
      if (isEditing) {
        await updateCredential(credential.id, values);
        toast.success("Credential updated");
      } else {
        await createCredential(values);
        toast.success("Credential saved");
        draft.clearDraft();
      }
      onSuccess();
    } catch {
      toast.error("Couldn't save this credential. Check the form and try again.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="platform">Platform</Label>
          <Input id="platform" {...register("platform")} placeholder="SAP, Outlook, cPanel, WiFi…" autoFocus />
          {errors.platform && <p className="text-xs text-destructive">{errors.platform.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <Input id="url" {...register("url")} placeholder="https://" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" {...register("username")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{isEditing ? "New password" : "Password"}</Label>
          {isEditing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Current: <RevealableSecret onReveal={() => revealCredentialPassword(credential.id)} />
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
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="credentials" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
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
          {isEditing ? "Save changes" : "Save credential"}
        </Button>
      </div>
    </form>
  );
}
