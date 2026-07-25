"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ActivityLog } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { multiSelectFilter } from "@/components/data-table/filter-fns";
import { isModuleKey, MODULES } from "@/config/modules";

export type AuditLogRow = ActivityLog & { admin: { name: string } | null };

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  archived: "Archived",
  restored: "Restored",
  deleted: "Deleted",
  duplicated: "Duplicated",
  login: "Login",
  logout: "Logout",
  password_revealed: "Password revealed",
  exported: "Exported",
  login_failed: "Failed login",
  account_locked: "Account locked",
  password_reset_requested: "Password reset requested",
  password_reset_completed: "Password reset completed",
  two_factor_enabled: "2FA enabled",
  two_factor_disabled: "2FA disabled",
  two_factor_failed: "2FA code invalid",
  recovery_codes_regenerated: "Recovery codes regenerated",
  sessions_revoked: "Sessions revoked",
  email_sent: "Email sent",
  email_failed: "Email failed",
};

const ACTION_STYLES: Record<string, string> = {
  created: "bg-success/15 text-success",
  updated: "bg-primary/15 text-primary",
  archived: "bg-warning/15 text-warning",
  restored: "bg-primary/15 text-primary",
  deleted: "bg-destructive/15 text-destructive",
  duplicated: "bg-secondary text-secondary-foreground",
  login: "bg-success/15 text-success",
  logout: "bg-muted text-muted-foreground",
  password_revealed: "bg-warning/15 text-warning",
  exported: "bg-primary/15 text-primary",
  login_failed: "bg-warning/15 text-warning",
  account_locked: "bg-destructive/15 text-destructive",
  password_reset_requested: "bg-warning/15 text-warning",
  password_reset_completed: "bg-success/15 text-success",
  two_factor_enabled: "bg-success/15 text-success",
  two_factor_disabled: "bg-warning/15 text-warning",
  two_factor_failed: "bg-destructive/15 text-destructive",
  recovery_codes_regenerated: "bg-primary/15 text-primary",
  sessions_revoked: "bg-warning/15 text-warning",
  email_sent: "bg-success/15 text-success",
  email_failed: "bg-destructive/15 text-destructive",
};

function moduleLabel(entityType: string): string {
  if (entityType === "Admin") return "Account";
  if (isModuleKey(entityType)) return MODULES[entityType].label;
  return entityType;
}

export function buildAuditLogColumns(): ColumnDef<AuditLogRow, unknown>[] {
  return [
    {
      id: "createdAt",
      accessorFn: (row) => row.createdAt,
      header: "Date & time",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: "action",
      accessorFn: (row) => row.action,
      header: "Action",
      filterFn: multiSelectFilter,
      cell: ({ row }) => (
        <Badge className={`border-0 ${ACTION_STYLES[row.original.action] ?? "bg-secondary text-secondary-foreground"}`}>
          {ACTION_LABELS[row.original.action] ?? row.original.action}
        </Badge>
      ),
    },
    {
      id: "module",
      accessorFn: (row) => row.entityType,
      header: "Module",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <span className="text-sm text-foreground">{moduleLabel(row.original.entityType)}</span>,
    },
    {
      id: "entityLabel",
      accessorFn: (row) => row.entityLabel ?? "",
      header: "Record",
      cell: ({ row }) => <span className="text-sm text-foreground">{row.original.entityLabel || "—"}</span>,
    },
    {
      id: "description",
      accessorFn: (row) => row.description ?? "",
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.description || "—"}</span>,
    },
    {
      id: "admin",
      accessorFn: (row) => row.admin?.name ?? "System",
      header: "Admin",
      filterFn: multiSelectFilter,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.admin?.name ?? "System"}</span>,
    },
  ];
}
