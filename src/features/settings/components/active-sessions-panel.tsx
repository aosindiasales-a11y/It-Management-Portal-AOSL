"use client";

import * as React from "react";
import { toast } from "sonner";
import { Laptop, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { timeAgo } from "@/lib/utils";
import { logoutAllOtherDevices, type ActiveSessionInfo } from "@/features/settings/actions";

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/iphone|ipad/i.test(userAgent)) return "iOS device";
  if (/android/i.test(userAgent)) return "Android device";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown device";
}

export function ActiveSessionsPanel({ sessions }: { sessions: ActiveSessionInfo[] }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Laptop className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{describeDevice(session.userAgent)}</p>
                  {session.isCurrent && <Badge variant="success">This device</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Signed in {timeAgo(session.createdAt)}
                  {session.ip ? ` · ${session.ip}` : ""}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)} disabled={otherCount === 0}>
        <LogOut className="h-4 w-4" />
        Log out of all other devices{otherCount > 0 ? ` (${otherCount})` : ""}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Log out of all other devices?"
        description="Every other browser and device signed in to this account will be signed out immediately. This device stays signed in."
        confirmLabel="Log out others"
        onConfirm={async () => {
          const result = await logoutAllOtherDevices();
          if (result.success) {
            toast.success("Signed out of all other devices");
          } else {
            toast.error(result.error ?? "Something went wrong.");
          }
        }}
      />
    </div>
  );
}
