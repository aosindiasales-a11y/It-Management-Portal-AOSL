"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Monitor } from "lucide-react";
import type { Category, Employee, System, Tag } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildSystemColumns } from "@/features/systems/components/system-columns";
import { SystemForm } from "@/features/systems/components/system-form";
import { archiveSystem, deleteSystem, duplicateSystem, getSystemTagIds, restoreSystem } from "@/features/systems/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface SystemsViewProps {
  systems: System[];
  categories: Category[];
  allTags: Tag[];
  employees: Employee[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function SystemsView({ systems, categories, allTags, employees, tagMap, customFieldDefs }: SystemsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<System | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<System | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<System | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = systems.find((s) => s.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(system: System) {
    setActive(system);
    setSheetMode("edit");
    setActiveTagIds(await getSystemTagIds(system.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/systems");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? systems : systems.filter((s) => !s.archivedAt);

  const columns = React.useMemo(
    () =>
      buildSystemColumns({
        categories,
        tagMap,
        allTags,
        employees,
        onEdit: openEdit,
        onDuplicate: async (system) => {
          await duplicateSystem(system.id);
          toast.success(`Duplicated ${system.name}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (system) => {
          await restoreSystem(system.id);
          toast.success(`Restored ${system.name}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tagMap, allTags, employees]
  );

  const statusOptions = [
    { label: "Active", value: "ACTIVE" },
    { label: "In repair", value: "IN_REPAIR" },
    { label: "Spare", value: "SPARE" },
    { label: "Retired", value: "RETIRED" },
  ];
  const employeeOptions = employees.map((e) => ({ label: e.name, value: e.id }));
  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id, color: c.color }));
  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.id, color: t.color }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Systems</h1>
          <p className="mt-1 text-sm text-muted-foreground">Asset registry with specs, warranty and history.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {systems.length === 0 ? (
        <EmptyState icon={Monitor} title="No systems yet" description="Register your first asset — laptop, desktop, printer or scanner." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search systems…"
          onRowClick={openEdit}
          exportTitle="Systems"
          exportModuleKey="systems"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("status")} title="Status" options={statusOptions} />
              <DataTableFacetFilter column={table.getColumn("assignedTo")} title="Employee" options={employeeOptions} />
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add System" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit system" : "Register system"}
        module="systems"
        recordId={active?.id}
      >
        <SystemForm
          system={active}
          initialTagIds={activeTagIds}
          categories={categories}
          allTags={allTags}
          employees={employees}
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
        description="Archived systems are hidden from the main list but can be restored anytime."
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveSystem(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.name}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently removes the system, its timeline and history. Consider archiving instead."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteSystem(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.name}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
