import type { Metadata } from "next";

import { getAuditLogs } from "@/features/activity/actions";
import { AuditLogView } from "@/features/activity/components/audit-log-view";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditLogsPage() {
  const logs = await getAuditLogs();

  return <AuditLogView logs={logs} />;
}
