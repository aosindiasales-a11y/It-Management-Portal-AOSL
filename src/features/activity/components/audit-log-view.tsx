"use client";

import * as React from "react";
import { History } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { MODULE_LIST } from "@/config/modules";
import { buildAuditLogColumns, type AuditLogRow } from "@/features/activity/components/audit-log-columns";

const ACTION_OPTIONS = [
  { label: "Created", value: "created" },
  { label: "Updated", value: "updated" },
  { label: "Archived", value: "archived" },
  { label: "Restored", value: "restored" },
  { label: "Deleted", value: "deleted" },
  { label: "Duplicated", value: "duplicated" },
  { label: "Login", value: "login" },
  { label: "Logout", value: "logout" },
  { label: "Password revealed", value: "password_revealed" },
  { label: "Exported", value: "exported" },
  { label: "Failed login", value: "login_failed" },
  { label: "Account locked", value: "account_locked" },
  { label: "Password reset requested", value: "password_reset_requested" },
  { label: "Password reset completed", value: "password_reset_completed" },
  { label: "2FA enabled", value: "two_factor_enabled" },
  { label: "2FA disabled", value: "two_factor_disabled" },
  { label: "2FA code invalid", value: "two_factor_failed" },
  { label: "Recovery codes regenerated", value: "recovery_codes_regenerated" },
  { label: "Sessions revoked", value: "sessions_revoked" },
  { label: "Email sent", value: "email_sent" },
  { label: "Email failed", value: "email_failed" },
];

const MODULE_OPTIONS = [{ label: "Account", value: "Admin" }, ...MODULE_LIST.map((m) => ({ label: m.label, value: m.key }))];

interface AuditLogViewProps {
  logs: AuditLogRow[];
}

export function AuditLogView({ logs }: AuditLogViewProps) {
  const columns = React.useMemo(() => buildAuditLogColumns(), []);
  const adminOptions = React.useMemo(() => {
    const names = new Set(logs.map((l) => l.admin?.name ?? "System"));
    return Array.from(names).map((name) => ({ label: name, value: name }));
  }, [logs]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every create, update, archive, delete, login, password reveal, lockout and two-factor event across the portal — most recent 1,000 events.
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Actions you take across the portal will show up here." />
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          searchPlaceholder="Search audit log…"
          pageSize={30}
          exportTitle="Audit Logs"
          exportModuleKey="Admin"
          toolbar={(table) => (
            <>
              <DataTableFacetFilter column={table.getColumn("action")} title="Action" options={ACTION_OPTIONS} />
              <DataTableFacetFilter column={table.getColumn("module")} title="Module" options={MODULE_OPTIONS} />
              {adminOptions.length > 1 && (
                <DataTableFacetFilter column={table.getColumn("admin")} title="Admin" options={adminOptions} />
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
