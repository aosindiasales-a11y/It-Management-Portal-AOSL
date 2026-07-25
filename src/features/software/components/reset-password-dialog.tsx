"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dices, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Software } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generatePasswordClientSide } from "@/lib/generate-password";
import { resetSoftwarePassword } from "@/features/software/actions";

interface ResetPasswordDialogProps {
  software: Software | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** Lightweight quick action — rotates a Microsoft 365 user's password without opening the full edit form. */
export function ResetPasswordDialog({ software, onOpenChange, onSuccess }: ResetPasswordDialogProps) {
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (software) {
      setPassword(generatePasswordClientSide());
      setShowPassword(false);
    }
  }, [software]);

  async function handleSubmit() {
    if (!software || !password) return;
    setSubmitting(true);
    try {
      await resetSoftwarePassword(software.id, password);
      toast.success(`Password reset for ${software.name}`);
      onSuccess();
    } catch {
      toast.error("Couldn't reset this password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!software} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {software?.name}. This replaces the current one immediately.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-20"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPassword(generatePasswordClientSide())}
                aria-label="Generate password"
              >
                <Dices className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !password}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
