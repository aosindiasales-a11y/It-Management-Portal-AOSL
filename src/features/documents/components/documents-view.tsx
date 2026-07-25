"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import type { Category, Document as DocumentRecord, Tag } from "@prisma/client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { RecordSheet } from "@/components/shared/record-sheet";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/use-hotkey";
import { buildDocumentColumns } from "@/features/documents/components/document-columns";
import { DocumentForm } from "@/features/documents/components/document-form";
import { archiveDocument, deleteDocument, duplicateDocument, getDocumentTagIds, restoreDocument } from "@/features/documents/actions";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

interface DocumentsViewProps {
  documents: DocumentRecord[];
  categories: Category[];
  allTags: Tag[];
  tagMap: Record<string, string[]>;
  customFieldDefs: CustomFieldDef[];
}

export function DocumentsView({ documents, categories, allTags, tagMap, customFieldDefs }: DocumentsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetMode, setSheetMode] = React.useState<"create" | "edit" | null>(null);
  const [active, setActive] = React.useState<DocumentRecord | null>(null);
  const [activeTagIds, setActiveTagIds] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<DocumentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DocumentRecord | null>(null);

  const openId = searchParams.get("open");
  React.useEffect(() => {
    if (!openId) return;
    const match = documents.find((d) => d.id === openId);
    if (match) openEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function openCreate() {
    setActive(null);
    setActiveTagIds([]);
    setSheetMode("create");
  }

  async function openEdit(doc: DocumentRecord) {
    setActive(doc);
    setSheetMode("edit");
    setActiveTagIds(await getDocumentTagIds(doc.id));
  }

  function closeSheet() {
    setSheetMode(null);
    if (openId) router.replace("/documents");
  }

  useHotkey("c", openCreate, sheetMode === null);

  const visible = showArchived ? documents : documents.filter((d) => !d.archivedAt);

  const columns = React.useMemo(
    () =>
      buildDocumentColumns({
        categories,
        tagMap,
        allTags,
        onEdit: openEdit,
        onDuplicate: async (doc) => {
          await duplicateDocument(doc.id);
          toast.success(`Duplicated ${doc.title}`);
          router.refresh();
        },
        onArchive: setArchiveTarget,
        onRestore: async (doc) => {
          await restoreDocument(doc.id);
          toast.success(`Restored ${doc.title}`);
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Invoices, warranties, drivers and manuals.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <Label className="cursor-pointer font-normal">Show archived</Label>
        </label>
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Upload invoices, warranty cards, drivers and manuals to keep them all in one place." />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          searchPlaceholder="Search documents…"
          onRowClick={openEdit}
          exportTitle="Documents"
          exportModuleKey="documents"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("category")} title="Category" options={categoryOptions} />
              <DataTableFacetFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />
            </>
          )}
        />
      )}

      <QuickAddFab label="Add Document" onClick={openCreate} />

      <RecordSheet
        open={sheetMode !== null}
        onOpenChange={(open) => !open && closeSheet()}
        title={sheetMode === "edit" ? "Edit document" : "Upload document"}
        module="documents"
        recordId={active?.id}
      >
        <DocumentForm
          document={active}
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
        title={`Archive ${archiveTarget?.title}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveDocument(archiveTarget.id);
          toast.success(`Archived ${archiveTarget.title}`);
          setArchiveTarget(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.title}?`}
        description="This permanently deletes the file and can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteDocument(deleteTarget.id);
          toast.success(`Deleted ${deleteTarget.title}`);
          setDeleteTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
