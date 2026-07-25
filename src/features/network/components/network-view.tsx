"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Network as NetworkIcon } from "lucide-react";
import type { Category, NetworkConfig, Tag } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildNetworkColumns } from "@/features/network/components/network-columns";
import { NetworkForm } from "@/features/network/components/network-form";
import { archiveNetworkConfig, deleteNetworkConfig, duplicateNetworkConfig, getNetworkTagIds, restoreNetworkConfig } from "@/features/network/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface NetworkViewProps {
  configs: NetworkConfig[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function NetworkView({ configs, categories, allTags, tagMap, customFieldDefs }: NetworkViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<NetworkConfig | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<NetworkConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<NetworkConfig | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = configs.find((c) => c.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(config: NetworkConfig) {
    setActive(config);
    setSheetMode("edit");
    setActiveTagIds(await getNetworkTagIds(config.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/network");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? configs : configs.filter((c) => !c.archivedAt);

  const columns = React.useMemo(
    () =>
      buildNetworkColumns({
        categories,
        tagMap,
        allTags,
        onEdit: openEdit,
        onDuplicate: async (config) => {
          await duplicateNetworkConfig(config.id);
          toast.success(`Duplicated ${config.label}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (config) => {
          await restoreNetworkConfig(config.id);
          toast.success(`Restored ${config.label}`);
          router.refresh();
        },
        onDelete: setDeleteTarget,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tagMap, allTags]
  );

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id, color: c.color }));
  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.id, color: t.color }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Network</h1>
          <p className="mt-1 text-sm text-muted-foreground">WiFi, router and ISP configuration.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {configs.length === 0 ? (
        <EmptyState icon={NetworkIcon} title="No network configs yet" description="Add your WiFi, router and ISP details so they're never lost in a notebook again." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search network configs…"
          onRowClick={openEdit}
          exportTitle="Network"
          exportModuleKey="network"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Network" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit network config" : "Add network config"}
        module="network"
        recordId={active?.id}
      >
        <NetworkForm
          config={active}
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
        title={`Archive ${archiveTarget?.label}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveNetworkConfig(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.label}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label}?`}
        description="This permanently removes the network config and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteNetworkConfig(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.label}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
