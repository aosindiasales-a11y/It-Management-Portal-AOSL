"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disableTwoFactor, regenerateRecoveryCodes, type TwoFactorStatus } from "@/features/settings/actions";
import { TwoFactorEnrollDialog } from "@/features/settings/components/two-factor-enroll-dialog";
import { RecoveryCodesDialog } from "@/features/settings/components/recovery-codes-dialog";
import { PasswordConfirmDialog } from "@/features/settings/components/password-confirm-dialog";

export function TwoFactorSettings({ initialStatus }: { initialStatus: TwoFactorStatus }) {
  const [status, setStatus] = React.useState(initialStatus);
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [regenerateOpen, setRegenerateOpen] = React.useState(false);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            {status.enabled ? <ShieldCheck className="h-4.5 w-4.5" /> : <ShieldOff className="h-4.5 w-4.5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Authenticator app</p>
              <Badge variant={status.enabled ? "success" : "secondary"}>{status.enabled ? "Enabled" : "Disabled"}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {status.enabled
                ? `Requires a 6-digit code at sign-in. ${status.recoveryCodesRemaining} recovery code${status.recoveryCodesRemaining === 1 ? "" : "s"} remaining.`
                : "Add a 6-digit code from Google Authenticator, Microsoft Authenticator or Authy to every sign-in."}
            </p>
          </div>
        </div>

        {status.enabled ? (
          <Button type="button" variant="outline" onClick={() => setDisableOpen(true)}>
            Disable
          </Button>
        ) : (
          <Button type="button" onClick={() => setEnrollOpen(true)}>
            Enable 2FA
          </Button>
        )}
      </div>

      {status.enabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Recovery codes</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              One-time codes to sign in if you lose your authenticator app. Regenerating replaces every unused code.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setRegenerateOpen(true)}>
            Regenerate codes
          </Button>
        </div>
      )}

      <TwoFactorEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnabled={(codes) => {
          setStatus({ enabled: true, recoveryCodesRemaining: codes.length });
          setRecoveryCodes(codes);
          toast.success("Two-factor authentication enabled");
        }}
      />

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

      <PasswordConfirmDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Regenerate recovery codes"
        description="Enter your password to confirm. Your existing recovery codes will stop working."
        confirmLabel="Regenerate"
        onConfirm={async (password) => {
          const result = await regenerateRecoveryCodes({ password });
          if (result.success && result.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
          return result;
        }}
        onSuccess={() => setStatus((s) => ({ ...s, recoveryCodesRemaining: 10 }))}
      />

      {recoveryCodes && (
        <RecoveryCodesDialog open={recoveryCodes !== null} onOpenChange={(open) => !open && setRecoveryCodes(null)} codes={recoveryCodes} />
      )}
    </div>
  );
}
