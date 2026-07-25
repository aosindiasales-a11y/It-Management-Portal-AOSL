"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { resetPassword } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/auth-card";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? "", newPassword: "", confirmPassword: "" },
  });

  const newPassword = watch("newPassword");

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    const result = await resetPassword(values);
    if (!result.success) {
      setFormError(result.error ?? "Couldn't reset your password. Please try again.");
      return;
    }
    toast.success("Password updated — please sign in.");
    router.push("/login");
  }

  if (!token) {
    return (
      <AuthCard title="Invalid reset link" eyebrow="Password reset">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">This password reset link is missing its token. Request a new one.</p>
          <Link href="/forgot-password" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" eyebrow="Password reset" description="Choose a strong password you haven't used before.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <input type="hidden" {...register("token")} />

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pl-9 pr-10"
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
          <PasswordStrengthMeter password={newPassword} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
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
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
