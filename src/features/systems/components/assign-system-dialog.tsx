"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Employee, System } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeePicker } from "@/features/systems/components/employee-picker";
import { assignSystem } from "@/features/systems/actions";

interface AssignSystemDialogProps {
  system: System | null;
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

/** Asset -> Assign Employee -> Confirm -> Asset becomes ALLOCATED. */
export function AssignSystemDialog({ system, employees, onOpenChange, onAssigned }: AssignSystemDialogProps) {
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setEmployeeId(system?.assignedEmployeeId ?? null);
  }, [system]);

  async function handleConfirm() {
    if (!system || !employeeId) return;
    setSaving(true);
    try {
      const result = await assignSystem(system.id, employeeId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Assigned ${system.name} to the selected employee`);
      onAssigned();
    } catch {
      toast.error("Couldn't assign this asset. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!system} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{system?.assignedEmployeeId ? "Reassign" : "Assign"} {system?.name}</DialogTitle>
          <DialogDescription>
            {system?.assetId} — choose an employee to allocate this asset to. It will be marked ALLOCATED.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Allocated person</Label>
          <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} placeholder="Choose an employee…" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving || !employeeId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
