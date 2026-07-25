"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import type { VpnCredential } from "@prisma/client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { formatDate, getInitials } from "@/lib/utils";
import { revealVpnPassword } from "@/features/vpn/actions";

const STATUS_STYLES: Record<string, string> = {
  Enabled: "bg-success/15 text-success",
  Disabled: "bg-destructive/15 text-destructive",
};

const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  Standard: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Administrator: "bg-brand-gold/20 text-brand-gold-foreground dark:text-brand-gold",
};

interface VpnDetailsPanelProps {
  vpn: VpnCredential;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Read-only content for the "View" mode of RecordSheet's Details tab. */
export function VpnDetailsPanel({ vpn }: VpnDetailsPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-base">{getInitials(vpn.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-base font-semibold text-foreground">{vpn.name}</p>
          <p className="text-sm text-muted-foreground">{vpn.username || "No username set"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mail ID">{vpn.mailId || "—"}</Field>
        <Field label="Password">
          <div className="flex items-center gap-1.5">
            <RevealableSecret onReveal={() => revealVpnPassword(vpn.id)} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={async () => {
                try {
                  const plaintext = await revealVpnPassword(vpn.id);
                  await navigator.clipboard.writeText(plaintext);
                  toast.success("Password copied");
                } catch {
                  toast.error("Couldn't copy the password.");
                }
              }}
              aria-label="Copy password"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Field>
        <Field label="Status">
          <Badge className={`border-0 font-normal ${STATUS_STYLES[vpn.status] ?? "bg-muted text-muted-foreground"}`}>{vpn.status}</Badge>
        </Field>
        <Field label="Active">
          {vpn.active ? (
            <Badge className="border-0 bg-success/15 font-normal text-success">Yes</Badge>
          ) : (
            <Badge className="border-0 bg-muted font-normal text-muted-foreground">No</Badge>
          )}
        </Field>
        <Field label="Account Type">
          <Badge className={`border-0 font-normal ${ACCOUNT_TYPE_STYLES[vpn.accountType] ?? "bg-secondary text-secondary-foreground"}`}>{vpn.accountType}</Badge>
        </Field>
        <Field label="Created">{formatDate(vpn.createdAt)}</Field>
        <Field label="Updated">{formatDate(vpn.updatedAt)}</Field>
      </div>
    </div>
  );
}
