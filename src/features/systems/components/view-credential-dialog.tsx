"use client";

import type { System } from "@prisma/client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RevealablePassword } from "@/features/credentials/components/revealable-password";
import type { SafeCredential } from "@/features/systems/types";

interface ViewCredentialDialogProps {
  system: System | null;
  credentials: SafeCredential[];
  onOpenChange: (open: boolean) => void;
}

/** Read-only view of the credential linked to a System — reuses the Credential Vault's own reveal action, so access stays admin-gated and audit-logged there, never duplicated here. */
export function ViewCredentialDialog({ system, credentials, onOpenChange }: ViewCredentialDialogProps) {
  const credential = system?.credentialId ? credentials.find((c) => c.id === system.credentialId) : null;

  return (
    <Dialog open={!!system && !!credential} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Credential for {system?.name}</DialogTitle>
          <DialogDescription>{system?.assetId}</DialogDescription>
        </DialogHeader>

        {credential && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <p className="text-sm text-foreground">{credential.platform}</p>
            </div>
            {credential.username && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Username</Label>
                <p className="text-sm text-foreground">{credential.username}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <RevealablePassword credentialId={credential.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
