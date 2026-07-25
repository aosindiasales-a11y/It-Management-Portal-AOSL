"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Software } from "@prisma/client";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Eye, KeyRound, RefreshCw } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { getInitials } from "@/lib/utils";
import { normalizeCustomFields } from "@/lib/json";
import type { CustomFieldValues } from "@/lib/custom-fields/types";
import { revealSoftwarePassword } from "@/features/software/actions";
import { LicenseBadges, splitLicenses } from "@/features/software/lib/license-badges";
import { downloadSoftwareCredentials } from "@/features/software/lib/generate-credential-file";
import { DownloadCredentialsDropdown, DownloadCredentialsSubmenu } from "@/features/software/components/download-credentials-menu";

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-success/15 text-success",
  Disabled: "bg-destructive/15 text-destructive",
  Pending: "bg-warning/15 text-warning",
};

function fieldsOf(software: Software): Record<string, unknown> {
  return normalizeCustomFields(software.customFields) as Record<string, unknown>;
}

function stringField(fields: Record<string, unknown>, key: string): string {
  return typeof fields[key] === "string" ? (fields[key] as string) : "";
}

interface BuildColumnsArgs {
  onEdit: (software: Software) => void;
  onDuplicate: (software: Software) => void;
  onArchive: (software: Software) => void;
  onRestore: (software: Software) => void;
  onDelete: (software: Software) => void;
  onViewDetails: (software: Software) => void;
  onResetPassword: (software: Software) => void;
  onChangeLicense: (software: Software) => void;
}

export function buildSoftwareColumns({
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onViewDetails,
  onResetPassword,
  onChangeLicense,
}: BuildColumnsArgs): ColumnDef<Software, unknown>[] {
  function handleDownload(software: Software, format: "pdf" | "docx" | "txt") {
    const fields = fieldsOf(software) as CustomFieldValues;
    downloadSoftwareCredentials(software, fields, format, () => revealSoftwarePassword(software.id)).catch(() => {
      toast.error("Couldn't generate that file.");
    });
  }

  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: "User",
      cell: ({ row }) => {
        const department = stringField(fieldsOf(row.original), "department");
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">{department || "—"}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "email",
      accessorFn: (row) => stringField(fieldsOf(row), "mail_id"),
      header: "Email Address",
      cell: ({ row }) => {
        const email = row.getValue<string>("email");
        if (!email) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm text-foreground">{email}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(email);
                toast.success("Email copied");
              }}
              aria-label="Copy email"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
    {
      id: "password",
      header: "Password",
      enableSorting: false,
      cell: ({ row }) => <RevealableSecret onReveal={() => revealSoftwarePassword(row.original.id)} />,
    },
    {
      id: "licenseType",
      accessorFn: (row) => splitLicenses(row.licenseType),
      header: "License",
      filterFn: "arrIncludesSome",
      cell: ({ row }) => <LicenseBadges licenseType={row.original.licenseType} />,
    },
    {
      id: "portal",
      header: "Microsoft Portal",
      enableSorting: false,
      cell: ({ row }) => {
        const url = row.original.downloadLink;
        if (!url) return <span className="text-muted-foreground">—</span>;
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="h-3 w-3" />
            Open Portal
          </Button>
        );
      },
    },
    {
      id: "download",
      header: "Download",
      enableSorting: false,
      cell: ({ row }) => (
        <DownloadCredentialsDropdown
          trigger={
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Download credentials">
              <Download className="h-4 w-4" />
            </Button>
          }
          onDownload={(format) => handleDownload(row.original, format)}
        />
      ),
    },
    {
      id: "status",
      accessorFn: (row) => stringField(fieldsOf(row), "status") || "Active",
      header: "Status",
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const status = row.getValue<string>("status");
        return <Badge className={`border-0 font-normal ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>{status}</Badge>;
      },
    },
    // Hidden — exist purely so the toolbar's facet filters have a column to bind to (see software-view.tsx's initialColumnVisibility).
    {
      id: "department",
      accessorFn: (row) => stringField(fieldsOf(row), "department"),
      header: "Department",
      filterFn: multiSelectFilter,
      cell: () => null,
    },
    {
      id: "location",
      accessorFn: (row) => stringField(fieldsOf(row), "location"),
      header: "Location",
      filterFn: multiSelectFilter,
      cell: () => null,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RowActionsMenu
            extraItems={
              <>
                <DropdownMenuItem onSelect={() => onViewDetails(row.original)}>
                  <Eye />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onResetPassword(row.original)}>
                  <KeyRound />
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onChangeLicense(row.original)}>
                  <RefreshCw />
                  Change License
                </DropdownMenuItem>
                <DownloadCredentialsSubmenu onDownload={(format) => handleDownload(row.original, format)} />
              </>
            }
            onEdit={() => onEdit(row.original)}
            onDuplicate={() => onDuplicate(row.original)}
            onArchive={!row.original.archivedAt ? () => onArchive(row.original) : undefined}
            onRestore={row.original.archivedAt ? () => onRestore(row.original) : undefined}
            onDelete={() => onDelete(row.original)}
            archived={!!row.original.archivedAt}
          />
        </div>
      ),
    },
  ];
}
