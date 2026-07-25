"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Category, Tag, Employee } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { CustomFieldsSection } from "@/features/custom-fields/components/custom-fields-section";
import { useDebouncedCallback, useDraft } from "@/hooks/use-draft";
import { employeeSchema, EMPLOYEE_DEFAULTS, EMPLOYEE_STATUSES, type EmployeeFormValues } from "@/features/employees/schema";
import { normalizeCustomFields } from "@/lib/json";
import { createEmployee, updateEmployee } from "@/features/employees/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

const STATUS_LABELS: Record<(typeof EMPLOYEE_STATUSES)[number], string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  RESIGNED: "Resigned",
  INACTIVE: "Inactive",
};

interface EmployeeFormProps {
  employee?: Employee | null;
  initialTagIds?: string[];
  categories: Category[];
  allTags: Tag[];
  customFieldDefs: CustomFieldDef[];
  onSuccess: () => void;
}

export function EmployeeForm({ employee, initialTagIds = [], categories, allTags, customFieldDefs, onSuccess }: EmployeeFormProps) {
  const isEditing = !!employee;
  const draft = useDraft<EmployeeFormValues>(`employees:${employee?.id ?? "new"}`);

  const defaultValues: EmployeeFormValues = employee
    ? {
        name: employee.name,
        department: employee.department,
        email: employee.email,
        phone: employee.phone ?? "",
        joiningDate: employee.joiningDate.toISOString().slice(0, 10),
        status: employee.status as EmployeeFormValues["status"],
        categoryId: employee.categoryId,
        notes: employee.notes ?? "",
        tagIds: initialTagIds,
        customFields: normalizeCustomFields(employee.customFields),
      }
    : draft.readDraft() ?? EMPLOYEE_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  const saveDraft = useDebouncedCallback(() => {
    if (!isEditing) draft.saveDraft(getValues());
  }, 500);

  React.useEffect(() => {
    const sub = watch(() => saveDraft());
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  async function onSubmit(values: EmployeeFormValues) {
    try {
      if (isEditing) {
        await updateEmployee(employee.id, values);
        toast.success("Employee updated");
      } else {
        await createEmployee(values);
        toast.success("Employee added");
        draft.clearDraft();
      }
      onSuccess();
    } catch {
      toast.error("Couldn't save this employee. Check the form and try again.");
    }
  }

  const categoryId = watch("categoryId") ?? null;
  const tagIds = watch("tagIds");
  const customFields = watch("customFields");
  const status = watch("status");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...register("name")} autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <Input id="department" {...register("department")} placeholder="Sales, Finance, IT…" />
          {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" {...register("phone")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="joiningDate">Joining date</Label>
          <Input id="joiningDate" type="date" {...register("joiningDate")} />
          {errors.joiningDate && <p className="text-xs text-destructive">{errors.joiningDate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setValue("status", v as EmployeeFormValues["status"])}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategoryPicker module="employees" categories={categories} value={categoryId} onChange={(v) => setValue("categoryId", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker allTags={allTags} value={tagIds} onChange={(v) => setValue("tagIds", v)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} placeholder="Anything worth remembering about this employee…" />
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
          {isEditing ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}
