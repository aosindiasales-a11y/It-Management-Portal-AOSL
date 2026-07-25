"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import type { Category, Software, Tag } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { normalizeCustomFields } from "@/lib/json";
import { buildSoftwareColumns } from "@/features/software/components/software-columns";
import { SoftwareForm } from "@/features/software/components/software-form";
import { SoftwareDetailsPanel } from "@/features/software/components/software-details-panel";
import { ResetPasswordDialog } from "@/features/software/components/reset-password-dialog";
import { ChangeLicensePopover } from "@/features/software/components/change-license-popover";
import { KNOWN_LICENSES, splitLicenses } from "@/features/software/lib/license-badges";
import { archiveSoftware, deleteSoftware, duplicateSoftware, getSoftwareTagIds, restoreSoftware } from "@/features/software/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface SoftwareViewProps {
  softwareList: Software[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

const STATUS_FILTER_OPTIONS = ["Active", "Disabled", "Pending"];

export function SoftwareView({ softwareList, categories, allTags, customFieldDefs }: SoftwareViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | "view" | null>(null);
  const [active, setActive] = React.useState<Software | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Software | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Software | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = React.useState<Software | null>(null);
  const [changeLicenseTarget, setChangeLicenseTarget] = React.useState<Software | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = softwareList.find((s) => s.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(software: Software) {
    setActive(software);
    setSheetMode("edit");
    setActiveTagIds(await getSoftwareTagIds(software.id));
  }

  async function openView(software: Software) {
    setActive(software);
    setSheetMode("view");
    setActiveTagIds(await getSoftwareTagIds(software.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/software");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? softwareList : softwareList.filter((s) => !s.archivedAt);

  const columns = React.useMemo(
    () =>
      buildSoftwareColumns({
        onEdit: openEdit,
        onDuplicate: async (software) => {
          await duplicateSoftware(software.id);
          toast.success(`Duplicated ${software.name}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (software) => {
          await restoreSoftware(software.id);
          toast.success(`Restored ${software.name}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
        onViewDetails: openView,
        onResetPassword: setResetPasswordTarget,
        onChangeLicense: setChangeLicenseTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const licenseOptions = React.useMemo(() => {
    const found = new Set<string>();
    for (const s of softwareList) for (const l of splitLicenses(s.licenseType)) found.add(l);
    for (const l of KNOWN_LICENSES) found.add(l);
    return Array.from(found).map((l) => ({ label: l, value: l }));
  }, [softwareList]);

  const departmentOptions = React.useMemo(() => {
    const found = new Set<string>();
    for (const s of softwareList) {
      const dept = normalizeCustomFields(s.customFields).department;
      if (typeof dept === "string" && dept) found.add(dept);
    }
    return Array.from(found).map((d) => ({ label: d, value: d }));
  }, [softwareList]);

  const locationOptions = React.useMemo(() => {
    const found = new Set<string>();
    for (const s of softwareList) {
      const loc = normalizeCustomFields(s.customFields).location;
      if (typeof loc === "string" && loc) found.add(loc);
    }
    return Array.from(found).map((l) => ({ label: l, value: l }));
  }, [softwareList]);

  const statusOptions = STATUS_FILTER_OPTIONS.map((s) => ({ label: s, value: s }));

  const sheetTitle = sheetMode === "create" ? "Add Microsoft User" : sheetMode === "view" ? active?.name ?? "User details" : "Edit Microsoft User";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Microsoft 365 User Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage Microsoft 365 user accounts, licenses, credentials and portal information.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {softwareList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Microsoft 365 users yet"
          description="Add your first Microsoft 365 account to track licenses, credentials and portal access in one place."
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search users…"
          onRowClick={openEdit}
          exportTitle="Software"
          exportModuleKey="software"
          initialColumnVisibility={{ department: false, location: false }}
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("licenseType")} title="License" options={licenseOptions} />
              <DataTableFacetFilter column={table.getColumn("department")} title="Department" options={departmentOptions} />
              <DataTableFacetFilter column={table.getColumn("status")} title="Status" options={statusOptions} />
              <DataTableFacetFilter column={table.getColumn("location")} title="Location" options={locationOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Microsoft User" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetTitle}
        module="software"
        recordId={active?.id}
      >
        {sheetMode === "view" && active ? (
          <SoftwareDetailsPanel software={active} />
        ) : (
          <SoftwareForm
            software={active}
            initialTagIds={activeTagIds}
            categories={categories}
            allTags={allTags}
            customFieldDefs={customFieldDefs}
            onSuccess={() => {
              closeSheet();
              router.refresh();
            }}
          />
        )}
      </RecordSheet>

      <ResetPasswordDialog
        software={resetPasswordTarget}
        onOpenChange={(open) => !open && setResetPasswordTarget(null)}
        onSuccess={() => {
          setResetPasswordTarget(null);
          router.refresh();
        }}
      />

      <ChangeLicensePopover
        software={changeLicenseTarget}
        onOpenChange={(open) => !open && setChangeLicenseTarget(null)}
        onSuccess={() => {
          setChangeLicenseTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveSoftware(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.name}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently removes the Microsoft 365 user record and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteSoftware(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.name}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
