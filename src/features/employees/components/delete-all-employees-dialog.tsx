"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteAllEmployees } from "@/features/employees/actions";
import { DELETE_ALL_CONFIRMATION_PHRASE } from "@/features/employees/schema";

interface DeleteAllEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeCount: number;
  onDeleted: () => void;
}

/**
 * The most destructive action in the Employees module — permanently deletes
 * every employee record. Gated behind typing the exact confirmation phrase
 * (checked again server-side, never trusted from here) so a stray click or
 * double-submit can never wipe the table.
 */
export function DeleteAllEmployeesDialog({ open, onOpenChange, employeeCount, onDeleted }: DeleteAllEmployeesDialogProps) {
  const [phrase, setPhrase] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const phraseMatches = phrase === DELETE_ALL_CONFIRMATION_PHRASE;

  function handleOpenChange(next: boolean) {
    if (!next && deleting) return; // never let a close interrupt an in-flight delete
    if (!next) setPhrase("");
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!phraseMatches || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteAllEmployees(phrase);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`All employees deleted successfully. ${result.deletedCount} employee record${result.deletedCount === 1 ? "" : "s"} were permanently deleted.`);
      setPhrase("");
      onOpenChange(false);
      onDeleted();
    } catch {
      toast.error("Something went wrong while deleting employees. Check the employee list before retrying.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete All Employees
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete all employee records.
            <br />
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Employees currently in database: <span className="font-semibold">{employeeCount}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delete-all-phrase">
              Type <span className="font-mono font-semibold">{DELETE_ALL_CONFIRMATION_PHRASE}</span> to confirm
            </Label>
            <Input
              id="delete-all-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={DELETE_ALL_CONFIRMATION_PHRASE}
              disabled={deleting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={!phraseMatches || deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Permanently Delete All Employees
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
