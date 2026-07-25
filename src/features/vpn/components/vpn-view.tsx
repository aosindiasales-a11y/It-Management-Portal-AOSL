"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import type { Category, VpnCredential } from "@prisma/client";

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
import { buildVpnColumns } from "@/features/vpn/components/vpn-columns";
import { VpnForm } from "@/features/vpn/components/vpn-form";
import { VpnDetailsPanel } from "@/features/vpn/components/vpn-details-panel";
import { VPN_STATUSES, VPN_ACCOUNT_TYPES } from "@/features/vpn/schema";
import { archiveVpnCredential, deleteVpnCredential, duplicateVpnCredential, restoreVpnCredential } from "@/features/vpn/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface VpnViewProps {
  vpnCredentials: VpnCredential[];
  categories: Category[];
  customFieldDefs: CustomFieldDef[];
}

const ACTIVE_OPTIONS = [
  { label: "Yes", value: "Yes" },
  { label: "No", value: "No" },
];

export function VpnView({ vpnCredentials, categories, customFieldDefs }: VpnViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | "view" | null>(null);
  const [active, setActive] = React.useState<VpnCredential | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<VpnCredential | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<VpnCredential | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = vpnCredentials.find((v) => v.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setSheetMode("create");
  }

  function openEdit(vpn: VpnCredential) {
    setActive(vpn);
    setSheetMode("edit");
  }

  function openView(vpn: VpnCredential) {
    setActive(vpn);
    setSheetMode("view");
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/vpn");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? vpnCredentials : vpnCredentials.filter((v) => !v.archivedAt);

  const columns = React.useMemo(
    () =>
      buildVpnColumns({
        onEdit: openEdit,
        onDuplicate: async (vpn) => {
          await duplicateVpnCredential(vpn.id);
          toast.success(`Duplicated ${vpn.name}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (vpn) => {
          await restoreVpnCredential(vpn.id);
          toast.success(`Restored ${vpn.name}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
        onViewDetails: openView,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const statusOptions = VPN_STATUSES.map((s) => ({ label: s, value: s }));
  const accountTypeOptions = VPN_ACCOUNT_TYPES.map((t) => ({ label: t, value: t }));

  const sheetTitle = sheetMode === "create" ? "Add VPN Credential" : sheetMode === "view" ? active?.name ?? "VPN details" : "Edit VPN Credential";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">VPN Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all VPN accounts and credentials from a single secure location.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {vpnCredentials.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="VPN Details"
          description={'No VPN accounts found. Click "Add VPN" to create your first VPN credential.'}
          action={<Button onClick={openCreate}>Add VPN</Button>}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={visible}
            searchPlaceholder="Search VPN accounts…"
            onRowClick={openEdit}
            exportTitle="VPN Details"
            exportModuleKey="vpn"
            toolbar={(table) => (
              <>
                <DataTableFacetFilter column={table.getColumn("status")} title="Status" options={statusOptions} />
                <DataTableFacetFilter column={table.getColumn("accountType")} title="Account Type" options={accountTypeOptions} />
                <DataTableFacetFilter column={table.getColumn("active")} title="Active" options={ACTIVE_OPTIONS} />
                <span className="ml-auto whitespace-nowrap text-sm text-muted-foreground">
                  {visible.length} record{visible.length === 1 ? "" : "s"}
                </span>
              </>
            )}
          />
        </>
      )}

      <QuickAddFab label="Add VPN" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetTitle}
        module="vpn"
        recordId={active?.id}
      >
        {sheetMode === "view" && active ? (
          <VpnDetailsPanel vpn={active} />
        ) : (
          <VpnForm
            vpn={active}
            categories={categories}
            customFieldDefs={customFieldDefs}
            onSuccess={() => {
              closeSheet();
              router.refresh();
            }}
            onCancel={closeSheet}
          />
        )}
      </RecordSheet>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveVpnCredential(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.name}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently removes the VPN credential and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteVpnCredential(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.name}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
