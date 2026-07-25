"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { beginTwoFactorEnrollment, confirmTwoFactorEnrollment } from "@/features/settings/actions";

interface TwoFactorEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnabled: (recoveryCodes: string[]) => void;
}

export function TwoFactorEnrollDialog({ open, onOpenChange, onEnabled }: TwoFactorEnrollDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [enrollment, setEnrollment] = React.useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setEnrollment(null);
      setCode("");
      setError(null);
      return;
    }
    setLoading(true);
    beginTwoFactorEnrollment().then((result) => {
      setLoading(false);
      if (!result.success || !result.qrDataUrl || !result.manualKey) {
        toast.error(result.error ?? "Couldn't start enrollment.");
        onOpenChange(false);
        return;
      }
      setEnrollment({ qrDataUrl: result.qrDataUrl, manualKey: result.manualKey });
    });
  }, [open, onOpenChange]);

  async function handleVerify() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await confirmTwoFactorEnrollment({ code });
      if (!result.success || !result.recoveryCodes) {
        setError(result.error ?? "That code isn't valid.");
        return;
      }
      onOpenChange(false);
      onEnabled(result.recoveryCodes);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enable two-factor authentication</DialogTitle>
          <DialogDescription>
            Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy or any compatible app.
          </DialogDescription>
        </DialogHeader>

        {loading || !enrollment ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl border border-border bg-white p-4">
              <Image src={enrollment.qrDataUrl} alt="Two-factor QR code" width={240} height={240} unoptimized />
            </div>

            <div className="space-y-1.5">
              <Label>Can&apos;t scan? Enter this key manually</Label>
              <code className="block break-all rounded-lg bg-secondary px-3 py-2 text-xs">{enrollment.manualKey}</code>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="enroll-code">Enter the 6-digit code to confirm</Label>
              <Input
                id="enroll-code"
                autoFocus
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="text-center tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={verifying}>
            Cancel
          </Button>
          <Button type="button" onClick={handleVerify} disabled={loading || !enrollment || verifying}>
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify &amp; enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
