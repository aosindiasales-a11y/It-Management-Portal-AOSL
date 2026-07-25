"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Software } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { KNOWN_LICENSES, splitLicenses } from "@/features/software/lib/license-badges";
import { updateSoftwareLicense } from "@/features/software/actions";

interface ChangeLicensePopoverProps {
  software: Software | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** Lightweight quick action — toggles which license SKUs a user holds without opening the full edit form. */
export function ChangeLicensePopover({ software, onOpenChange, onSuccess }: ChangeLicensePopoverProps) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [other, setOther] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!software) return;
    const current = splitLicenses(software.licenseType);
    setSelected(current.filter((l) => (KNOWN_LICENSES as readonly string[]).includes(l)));
    setOther(current.find((l) => !(KNOWN_LICENSES as readonly string[]).includes(l)) ?? "");
  }, [software]);

  function toggle(license: string) {
    setSelected((prev) => (prev.includes(license) ? prev.filter((l) => l !== license) : [...prev, license]));
  }

  async function handleSubmit() {
    if (!software) return;
    setSubmitting(true);
    try {
      const licenseType = [...selected, other.trim()].filter(Boolean).join("+");
      await updateSoftwareLicense(software.id, licenseType);
      toast.success(`License updated for ${software.name}`);
      onSuccess();
    } catch {
      toast.error("Couldn't update the license. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!software} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change license</DialogTitle>
          <DialogDescription>Update which Microsoft 365 licenses {software?.name} holds.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {KNOWN_LICENSES.map((license) => (
            <label key={license} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selected.includes(license)} onCheckedChange={() => toggle(license)} />
              {license}
            </label>
          ))}

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="other-license">Other</Label>
            <Input id="other-license" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Free-text license name…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
