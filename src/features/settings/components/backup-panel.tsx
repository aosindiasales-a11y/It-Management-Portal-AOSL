"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, Download, HardDriveDownload, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { runManualBackup, restoreFromUpload } from "@/features/backup/actions";
import type { BackupFile } from "@/lib/backup";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BackupPanel({ backups }: { backups: BackupFile[] }) {
  const router = useRouter();
  const [runningBackup, setRunningBackup] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [restoring, setRestoring] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleManualBackup() {
    setRunningBackup(true);
    try {
      await runManualBackup();
      toast.success("Backup created");
      router.refresh();
    } catch {
      toast.error("Couldn't create a backup.");
    } finally {
      setRunningBackup(false);
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    e.target.value = "";
  }

  async function handleRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.set("file", pendingFile);
      const result = await restoreFromUpload(formData);
      if (result.success) {
        toast.success("Database restored. Restart the app for the change to take effect.");
      } else {
        toast.error(result.error ?? "Restore failed.");
      }
    } catch {
      toast.error("Restore failed.");
    } finally {
      setRestoring(false);
      setPendingFile(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; restore</CardTitle>
          <CardDescription>
            Everything lives in one SQLite file. Back it up regularly and keep a copy somewhere safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5">
          <Button onClick={handleManualBackup} disabled={runningBackup}>
            {runningBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Create backup now
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/backup/database" download>
              <HardDriveDownload className="h-4 w-4" />
              Download SQLite database
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/backup/export" download>
              <Download className="h-4 w-4" />
              Export as JSON
            </a>
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={restoring}>
            <Upload className="h-4 w-4" />
            Restore from .db file
          </Button>
          <input ref={fileInputRef} type="file" accept=".db" className="hidden" onChange={handleFilePicked} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent backups</CardTitle>
          <CardDescription>Kept automatically in storage/backups — the 20 most recent per type.</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <EmptyState icon={Database} title="No backups yet" description="Create your first backup above." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {backups.slice(0, 10).map((b) => (
                <li key={b.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="truncate font-mono text-xs text-foreground">{b.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatSize(b.sizeBytes)} · {formatDate(b.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingFile}
        onOpenChange={(open) => !open && setPendingFile(null)}
        title="Restore database?"
        description={`This replaces all current data with the contents of "${pendingFile?.name}". A safety backup of the current database is taken automatically first. You'll need to restart the app afterward.`}
        confirmLabel="Restore"
        destructive
        onConfirm={handleRestore}
      />
    </div>
  );
}
