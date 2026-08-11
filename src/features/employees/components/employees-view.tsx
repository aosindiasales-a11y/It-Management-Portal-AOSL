"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import type { Category, Employee, Tag } from "@prisma/client";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildEmployeeColumns } from "@/features/employees/components/employee-columns";
import { EmployeeForm } from "@/features/employees/components/employee-form";
import { archiveEmployee, deleteEmployee, duplicateEmployee, getEmployeeTagIds, restoreEmployee } from "@/features/employees/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface EmployeesViewProps {
  employees: Employee[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function EmployeesView({ employees, categories, allTags, tagMap, customFieldDefs }: EmployeesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Employee | null>(null);

  const openEmployeeId = searchParams.get("open");
  React.useEffect(() => {
    if (!openEmployeeId) return;
    const match = employees.find((e) => e.id === openEmployeeId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEmployeeId]);

  function openCreate() {
    setActiveEmployee(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(employee: Employee) {
    setActiveEmployee(employee);
    setSheetMode("edit");
    const ids = await getEmployeeTagIds(employee.id);
    setActiveTagIds(ids);
  }

  function closeSheet() {
    setSheetMode(null);
    if (openEmployeeId) router.replace("/employees");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? employees : employees.filter((e) => !e.archivedAt);

  const columns = React.useMemo(
    () =>
      buildEmployeeColumns({
        categories,
        tagMap,
        allTags,
        onEdit: openEdit,
        onDuplicate: async (employee) => {
          await duplicateEmployee(employee.id);
          toast.success(`Duplicated ${employee.name}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (employee) => {
          await restoreEmployee(employee.id);
          toast.success(`Restored ${employee.name}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tagMap, allTags]
  );

  const departmentOptions = Array.from(new Set(employees.map((e) => e.department))).map((d) => ({ label: d, value: d }));
  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id, color: c.color }));
  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.id, color: t.color }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Directory, departments and system allocation.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Add your first employee to start tracking allocation, credentials and tasks against them."
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search employees…"
          onRowClick={openEdit}
          exportTitle="Employees"
          exportModuleKey="employees"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("department")} title="Department" options={departmentOptions} />
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Employee" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit employee" : "Add employee"}
        module="employees"
        recordId={activeEmployee?.id}
      >
        <EmployeeForm
          employee={activeEmployee}
          initialTagIds={activeTagIds}
          categories={categories}
          allTags={allTags}
          customFieldDefs={customFieldDefs}
          onSuccess={() => {
            closeSheet();
            router.refresh();
          }}
        />
      </RecordSheet>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name}?`}
        description="Archived employees are hidden from the main list but can be restored anytime."
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveEmployee(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.name}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently removes the employee and can't be undone. Consider archiving instead."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteEmployee(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.name}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
