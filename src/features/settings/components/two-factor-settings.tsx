"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disableTwoFactor, type TwoFactorStatus } from "@/features/settings/actions";
import { PasswordConfirmDialog } from "@/features/settings/components/password-confirm-dialog";

/**
 * This portal is single-admin with no second login step by design — the
 * login action ignores twoFactorEnabled entirely, and enrollment is refused
 * server-side (see beginTwoFactorEnrollment). "Disable" stays available so
 * an account enrolled before this change can still clear the now-inert flag
 * and its recovery codes.
 */
export function TwoFactorSettings({ initialStatus }: { initialStatus: TwoFactorStatus }) {
  const [status, setStatus] = React.useState(initialStatus);
  const [disableOpen, setDisableOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
          {status.enabled ? <ShieldCheck className="h-4.5 w-4.5" /> : <ShieldOff className="h-4.5 w-4.5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">Authenticator app</p>
            <Badge variant={status.enabled ? "success" : "secondary"}>{status.enabled ? "Enabled" : "Turned off"}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Turned off for this single-admin portal — sign-in only needs your password, protected by the account lockout and rate limiting above.
          </p>
        </div>
      </div>

      {status.enabled && (
        <Button type="button" variant="outline" onClick={() => setDisableOpen(true)}>
          Disable
        </Button>
      )}

      <PasswordConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable two-factor authentication"
        description="Enter your password to confirm. Your recovery codes will stop working."
        confirmLabel="Disable"
        destructive
        onConfirm={(password) => disableTwoFactor({ password })}
        onSuccess={() => {
          setStatus({ enabled: false, recoveryCodesRemaining: 0 });
          toast.success("Two-factor authentication disabled");
        }}
      />
    </div>
  );
}
