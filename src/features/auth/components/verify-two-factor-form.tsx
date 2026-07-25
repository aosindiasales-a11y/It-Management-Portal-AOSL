"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyTwoFactorSchema, type VerifyTwoFactorInput } from "@/lib/validations/auth";
import { verifyTwoFactorLogin, sendLoginOtpAction } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/auth-card";

type VerifyMode = "totp" | "recovery" | "email";

const RESEND_COOLDOWN_SECONDS = 60;

const MODE_META: Record<VerifyMode, { label: string; description: string; placeholder: string; maxLength: number; icon: React.ElementType }> = {
  totp: {
    label: "Authentication code",
    description: "Enter the 6-digit code from your authenticator app.",
    placeholder: "123456",
    maxLength: 6,
    icon: ShieldCheck,
  },
  recovery: {
    label: "Recovery code",
    description: "Enter one of your unused recovery codes.",
    placeholder: "XXXX-XXXX",
    maxLength: 9,
    icon: KeyRound,
  },
  email: {
    label: "Emailed code",
    description: "Enter the 6-digit code we emailed you.",
    placeholder: "123456",
    maxLength: 6,
    icon: Mail,
  },
};

export function VerifyTwoFactorForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<VerifyMode>("totp");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VerifyTwoFactorInput>({
    resolver: zodResolver(verifyTwoFactorSchema),
    defaultValues: { code: "" },
  });

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function requestEmailOtp() {
    setSendingOtp(true);
    setFormError(null);
    try {
      const result = await sendLoginOtpAction();
      if (!result.success) {
        toast.error(result.error ?? "Couldn't send that code.");
        return;
      }
      toast.success("Code sent — check your email");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setSendingOtp(false);
    }
  }

  function switchMode(next: VerifyMode) {
    setMode(next);
    setFormError(null);
    reset({ code: "" });
    if (next === "email" && cooldown === 0) {
      void requestEmailOtp();
    }
  }

  async function onSubmit(values: VerifyTwoFactorInput) {
    setFormError(null);
    const result = await verifyTwoFactorLogin(values);
    if (!result.success) {
      setFormError(result.error ?? "That code isn't valid. Please try again.");
      reset({ code: "" });
      return;
    }
    toast.success("Welcome back");
    router.push("/dashboard");
    router.refresh();
  }

  const meta = MODE_META[mode];
  const Icon = meta.icon;

  return (
    <AuthCard title="Two-factor verification" eyebrow="One more step" description={meta.description}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">{meta.label}</Label>
          <div className="relative">
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="code"
              autoFocus
              autoComplete="one-time-code"
              inputMode={mode === "recovery" ? "text" : "numeric"}
              placeholder={meta.placeholder}
              className="pl-9 text-center tracking-[0.3em]"
              maxLength={meta.maxLength}
              aria-invalid={!!errors.code}
              {...register("code")}
            />
          </div>
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          {mode === "email" && (
            <button
              type="button"
              onClick={requestEmailOtp}
              disabled={sendingOtp || cooldown > 0}
              className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              {sendingOtp ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          )}
        </div>

        {formError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {formError}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-primary to-[hsl(215_78%_38%)] shadow-glow transition-all duration-300 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_18px_40px_-10px_hsl(var(--primary)/0.6)] hover:brightness-110"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Verify
        </Button>

        <div className="flex flex-col items-center gap-1.5">
          {mode !== "totp" && (
            <button type="button" onClick={() => switchMode("totp")} className="text-sm font-medium text-primary hover:underline">
              Use my authenticator app instead
            </button>
          )}
          {mode !== "recovery" && (
            <button type="button" onClick={() => switchMode("recovery")} className="text-sm font-medium text-primary hover:underline">
              Use a recovery code instead
            </button>
          )}
          {mode !== "email" && (
            <button type="button" onClick={() => switchMode("email")} className="text-sm font-medium text-primary hover:underline">
              Email me a code instead
            </button>
          )}
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}
