"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink } from "lucide-react";
import type { Software } from "@prisma/client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { formatDate, getInitials } from "@/lib/utils";
import { normalizeCustomFields } from "@/lib/json";
import type { CustomFieldValues } from "@/lib/custom-fields/types";
import { revealSoftwarePassword } from "@/features/software/actions";
import { LicenseBadges } from "@/features/software/lib/license-badges";
import { downloadSoftwareCredentials } from "@/features/software/lib/generate-credential-file";
import { DownloadCredentialsDropdown } from "@/features/software/components/download-credentials-menu";

interface SoftwareDetailsPanelProps {
  software: Software;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Read-only content for the "View Details" mode of RecordSheet's Details tab. */
export function SoftwareDetailsPanel({ software }: SoftwareDetailsPanelProps) {
  const fields = normalizeCustomFields(software.customFields) as Record<string, unknown>;
  const email = typeof fields.mail_id === "string" ? fields.mail_id : "";
  const department = typeof fields.department === "string" ? fields.department : "";
  const status = typeof fields.status === "string" && fields.status ? fields.status : "Active";
  const assignedBy = typeof fields.assigned_by === "string" ? fields.assigned_by : "";
  const lastLogin = typeof fields.last_login === "string" ? fields.last_login : "";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-base">{getInitials(software.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-base font-semibold text-foreground">{software.name}</p>
          <p className="text-sm text-muted-foreground">{department || "No department set"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email">
          {email ? (
            <div className="flex items-center gap-1.5">
              <span className="truncate">{email}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  navigator.clipboard.writeText(email);
                  toast.success("Email copied");
                }}
                aria-label="Copy email"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Password">
          <RevealableSecret onReveal={() => revealSoftwarePassword(software.id)} />
        </Field>
        <Field label="License">
          <LicenseBadges licenseType={software.licenseType} />
        </Field>
        <Field label="Status">{status}</Field>
        <Field label="Microsoft Portal">
          {software.downloadLink ? (
            <a
              href={software.downloadLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open Portal
            </a>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Assigned by">{assignedBy || "—"}</Field>
        <Field label="Last login">{lastLogin ? formatDate(lastLogin) : "—"}</Field>
        <Field label="Created">{formatDate(software.createdAt)}</Field>
        <Field label="Updated">{formatDate(software.updatedAt)}</Field>
      </div>

      {software.notes && <Field label="Notes">{software.notes}</Field>}

      <DownloadCredentialsDropdown
        trigger={
          <Button type="button" variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Credentials
          </Button>
        }
        onDownload={(format) =>
          downloadSoftwareCredentials(software, fields as CustomFieldValues, format, () => revealSoftwarePassword(software.id)).catch(() => {
            toast.error("Couldn't generate that file.");
          })
        }
      />
    </div>
  );
}
