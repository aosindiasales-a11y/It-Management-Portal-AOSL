"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import type { Category, Credential, Tag } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildCredentialColumns } from "@/features/credentials/components/credential-columns";
import { CredentialForm } from "@/features/credentials/components/credential-form";
import {
  archiveCredential,
  deleteCredential,
  duplicateCredential,
  getCredentialTagIds,
  restoreCredential,
} from "@/features/credentials/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface CredentialsViewProps {
  credentials: Credential[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function CredentialsView({ credentials, categories, allTags, tagMap, customFieldDefs }: CredentialsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<Credential | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Credential | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = credentials.find((c) => c.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(credential: Credential) {
    setActive(credential);
    setSheetMode("edit");
    setActiveTagIds(await getCredentialTagIds(credential.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/credentials");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? credentials : credentials.filter((c) => !c.archivedAt);

  const columns = React.useMemo(
    () =>
      buildCredentialColumns({
        categories,
        tagMap,
        allTags,
        onEdit: openEdit,
        onDuplicate: async (credential) => {
          await duplicateCredential(credential.id);
          toast.success(`Duplicated ${credential.platform}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (credential) => {
          await restoreCredential(credential.id);
          toast.success(`Restored ${credential.platform}`);
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Credentials</h1>
          <p className="mt-1 text-sm text-muted-foreground">Encrypted vault for every login your team relies on.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {credentials.length === 0 ? (
        <EmptyState icon={KeyRound} title="No credentials saved yet" description="Add your first login — SAP, WiFi, hosting, anything your team needs access to." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search credentials…"
          onRowClick={openEdit}
          exportTitle="Credentials"
          exportModuleKey="credentials"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Credential" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit credential" : "Add credential"}
        module="credentials"
        recordId={active?.id}
      >
        <CredentialForm
          credential={active}
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
        title={`Archive credential for ${archiveTarget?.platform}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveCredential(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.platform}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete credential for ${deleteTarget?.platform}?`}
        description="This permanently removes the stored password and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteCredential(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.platform}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
