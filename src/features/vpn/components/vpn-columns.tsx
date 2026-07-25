"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { VpnCredential } from "@prisma/client";
import { toast } from "sonner";
import { Copy, Eye } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { RevealableSecret } from "@/components/shared/revealable-secret";
import { getInitials } from "@/lib/utils";
import { revealVpnPassword } from "@/features/vpn/actions";

const STATUS_STYLES: Record<string, string> = {
  Enabled: "bg-success/15 text-success",
  Disabled: "bg-destructive/15 text-destructive",
};

const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  Standard: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Administrator: "bg-brand-gold/20 text-brand-gold-foreground dark:text-brand-gold",
};

interface BuildColumnsArgs {
  onEdit: (vpn: VpnCredential) => void;
  onDuplicate: (vpn: VpnCredential) => void;
  onArchive: (vpn: VpnCredential) => void;
  onRestore: (vpn: VpnCredential) => void;
  onDelete: (vpn: VpnCredential) => void;
  onViewDetails: (vpn: VpnCredential) => void;
}

export function buildVpnColumns({ onEdit, onDuplicate, onArchive, onRestore, onDelete, onViewDetails }: BuildColumnsArgs): ColumnDef<VpnCredential, unknown>[] {
  async function copyPassword(vpn: VpnCredential) {
    try {
      const plaintext = await revealVpnPassword(vpn.id);
      await navigator.clipboard.writeText(plaintext);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy the password.");
    }
  }

  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <p className="truncate text-sm font-medium text-foreground">{row.original.name}</p>
        </div>
      ),
    },
    {
      id: "username",
      accessorFn: (row) => row.username ?? "",
      header: "Username",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.username || "—"}</span>,
    },
    {
      id: "password",
      header: "Password",
      enableSorting: false,
      cell: ({ row }) => <RevealableSecret onReveal={() => revealVpnPassword(row.original.id)} />,
    },
    {
      id: "mailId",
      accessorFn: (row) => row.mailId ?? "",
      header: "Mail ID",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.mailId || "—"}</span>,
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: "Status",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <Badge className={`border-0 font-normal ${STATUS_STYLES[row.original.status] ?? "bg-muted text-muted-foreground"}`}>{row.original.status}</Badge>,
    },
    {
      id: "active",
      accessorFn: (row) => (row.active ? "Yes" : "No"),
      header: "Active",
      filterFn: multiSelectFilter,
      cell: ({ row }) =>
        row.original.active ? (
          <Badge className="border-0 bg-success/15 font-normal text-success">Yes</Badge>
        ) : (
          <Badge className="border-0 bg-muted font-normal text-muted-foreground">No</Badge>
        ),
    },
    {
      id: "accountType",
      accessorFn: (row) => row.accountType,
      header: "Account Type",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <Badge className={`border-0 font-normal ${ACCOUNT_TYPE_STYLES[row.original.accountType] ?? "bg-secondary text-secondary-foreground"}`}>{row.original.accountType}</Badge>,
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
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => copyPassword(row.original)}>
                  <Copy />
                  Copy Password
                </DropdownMenuItem>
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
