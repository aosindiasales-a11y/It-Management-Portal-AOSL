"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RecoveryCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codes: string[];
}

/** Shows a freshly-generated batch of recovery codes exactly once — they're bcrypt-hashed at rest and can never be displayed again after this. */
export function RecoveryCodesDialog({ open, onOpenChange, codes }: RecoveryCodesDialogProps) {
  const [copied, setCopied] = React.useState(false);

  function download() {
    const blob = new Blob(
      [`IT Manager Portal — Two-Factor Recovery Codes\nGenerated ${new Date().toLocaleString()}\nEach code can be used once.\n\n${codes.join("\n")}\n`],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "it-manager-portal-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your recovery codes</DialogTitle>
          <DialogDescription>
            Each code can be used once to sign in if you lose access to your authenticator app. Store them somewhere
            safe — they won&apos;t be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-4 font-mono text-sm">
          {codes.map((code) => (
            <span key={code} className="text-foreground">
              {code}
            </span>
          ))}
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyAll}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy all
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={download}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
          <Button type="button" onClick={() => onOpenChange(false)}>
            I&apos;ve saved these
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
