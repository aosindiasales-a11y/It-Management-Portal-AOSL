"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Monitor, Upload } from "lucide-react";
import type { Category, Employee, System, Tag } from "@prisma/client";
import type { SafeCredential } from "@/features/systems/types";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildSystemColumns } from "@/features/systems/components/system-columns";
import { SystemForm } from "@/features/systems/components/system-form";
import { AssignSystemDialog } from "@/features/systems/components/assign-system-dialog";
import { ViewCredentialDialog } from "@/features/systems/components/view-credential-dialog";
import { ImportSystemsDialog } from "@/features/systems/components/import-systems-dialog";
import { archiveSystem, deleteSystem, duplicateSystem, getSystemTagIds, markSystemVacant, restoreSystem } from "@/features/systems/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";
import type { SYSTEM_STATUSES } from "@/features/systems/schema";

interface SystemsViewProps {
  systems: System[];
  categories: Category[];
  allTags: Tag[];
  employees: Employee[];
  credentials: SafeCredential[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

const STATUS_LABELS: Record<(typeof SYSTEM_STATUSES)[number], string> = {
  ALLOCATED: "Allocated",
  VACANT: "Vacant",
  REPAIR: "Repair",
  RETIRED: "Retired",
};

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function SystemsView({ systems, categories, allTags, employees, credentials, tagMap, customFieldDefs }: SystemsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<System | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<System | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<System | null>(null);
  const [assignTarget, setAssignTarget] = React.useState<System | null>(null);
  const [vacantTarget, setVacantTarget] = React.useState<System | null>(null);
  const [credentialTarget, setCredentialTarget] = React.useState<System | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

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

  const summary = React.useMemo(
    () => ({
      total: visible.length,
      allocated: visible.filter((s) => s.status === "ALLOCATED").length,
      vacant: visible.filter((s) => s.status === "VACANT").length,
      repair: visible.filter((s) => s.status === "REPAIR").length,
      retired: visible.filter((s) => s.status === "RETIRED").length,
    }),
    [visible]
  );

  const columns = React.useMemo(
    () =>
      buildSystemColumns({
        categories,
        tagMap,
        allTags,
        employees,
        credentials,
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
        onAssign: setAssignTarget,
        onMarkVacant: setVacantTarget,
        onViewCredential: setCredentialTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tagMap, allTags, employees, credentials]
  );

  const statusOptions = (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => ({ label: STATUS_LABELS[s], value: s }));
  const employeeOptions = employees.map((e) => ({ label: e.name, value: e.id }));
  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id, color: c.color }));
  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.id, color: t.color }));
  const assetTypeOptions = Array.from(new Set(systems.map((s) => s.assetType).filter((t): t is string => !!t))).map((t) => ({ label: t, value: t }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Systems</h1>
          <p className="mt-1 text-sm text-muted-foreground">Asset registry with specs, warranty and history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            <Label className="cursor-pointer font-normal">Show archived</Label>
          </label>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/systems/import-template">
              <Download className="h-3.5 w-3.5" />
              Download Template
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import Assets
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Total Assets" value={summary.total} />
        <SummaryCard label="Allocated" value={summary.allocated} />
        <SummaryCard label="Vacant" value={summary.vacant} />
        <SummaryCard label="Repair" value={summary.repair} />
        <SummaryCard label="Retired" value={summary.retired} />
      </div>

      {systems.length === 0 ? (
        <EmptyState icon={Monitor} title="No systems yet" description="Register your first asset — laptop, desktop, printer or scanner." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search assets…"
          onRowClick={openEdit}
          exportTitle="Systems"
          exportModuleKey="systems"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("status")} title="Status" options={statusOptions} />
              <DataTableFacetFilter column={table.getColumn("assetType")} title="Type" options={assetTypeOptions} />
              <DataTableFacetFilter column={table.getColumn("assignedTo")} title="Employee" options={employeeOptions} />
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Asset" onClick={openCreate} />

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
          credentials={credentials}
          customFieldDefs={customFieldDefs}
          onSuccess={() => {
            closeSheet();
            router.refresh();
          }}
        />
      </RecordSheet>

      <AssignSystemDialog
        system={assignTarget}
        employees={employees}
        onOpenChange={(open) => !open && setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          router.refresh();
        }}
      />

      <ViewCredentialDialog system={credentialTarget} credentials={credentials} onOpenChange={(open) => !open && setCredentialTarget(null)} />

      <ImportSystemsDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => router.refresh()} />

      <ConfirmDialog
        open={!!vacantTarget}
        onOpenChange={(open) => !open && setVacantTarget(null)}
        title={`Mark ${vacantTarget?.name} vacant?`}
        description="This unassigns the current employee and sets the asset to VACANT. The asset itself is not deleted."
        confirmLabel="Mark Vacant"
        onConfirm={async () => {
          if (!vacantTarget) return;
          await markSystemVacant(vacantTarget.id);
          toast.success(`Marked ${vacantTarget.name} vacant`);
          setVacantTarget(null);
          router.refresh();
        }}
      />

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
