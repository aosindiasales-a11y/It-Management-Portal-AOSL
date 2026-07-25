"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { revealCredentialPassword } from "@/features/credentials/actions";

/** Shows a stored password only after an explicit click, auto-hides after 20s, and offers a one-click copy. */
export function RevealablePassword({ credentialId }: { credentialId: string }) {
  const [value, setValue] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  async function reveal() {
    if (value) {
      setValue(null);
      return;
    }
    setLoading(true);
    try {
      const plaintext = await revealCredentialPassword(credentialId);
      setValue(plaintext);
      hideTimer.current = setTimeout(() => setValue(null), 20000);
    } catch {
      toast.error("Couldn't decrypt this password.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    const plaintext = value ?? (await revealCredentialPassword(credentialId).catch(() => null));
    if (!plaintext) {
      toast.error("Couldn't copy this password.");
      return;
    }
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
    toast.success("Password copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1.5">
      <code className="min-w-[7rem] rounded-md bg-secondary px-2 py-1 text-xs">
        {value ? value : "••••••••••"}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          reveal();
        }}
        disabled={loading}
        aria-label={value ? "Hide password" : "Show password"}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : value ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          copy();
        }}
        aria-label="Copy password"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
