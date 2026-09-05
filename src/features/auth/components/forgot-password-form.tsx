"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { forgotPassword } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/auth-card";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = React.useState(false);
  const [devResetUrl, setDevResetUrl] = React.useState<string | null>(null);
  const developmentResetUrl = process.env.NODE_ENV !== "production" ? devResetUrl : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const result = await forgotPassword(values);
    setDevResetUrl(result.devResetUrl ?? null);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthCard title="Check your email" eyebrow="Password reset">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            If an account matches that email, we&apos;ve sent a link to reset your password. It expires in 15 minutes.
          </p>
          {developmentResetUrl && (
            <div className="space-y-1.5 rounded-lg border border-warning/30 bg-warning/10 p-3.5 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-warning">Development reset link</p>
              <p className="text-xs text-muted-foreground">
                Local email delivery is unavailable. Use this development-only link:
              </p>
              <a href={developmentResetUrl} className="block break-all text-xs font-medium text-primary hover:underline">
                {developmentResetUrl}
              </a>
            </div>
          )}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      eyebrow="Password reset"
      description="Enter your account email and we'll send you a link to reset it."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              className="pl-9"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-primary to-[hsl(215_78%_38%)] shadow-glow transition-all duration-300 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_18px_40px_-10px_hsl(var(--primary)/0.6)] hover:brightness-110"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </Button>

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
