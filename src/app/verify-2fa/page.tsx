import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getPending2FASession } from "@/lib/auth/session";
import { VerifyTwoFactorForm } from "@/features/auth/components/verify-two-factor-form";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = {
  title: "Verify it's you",
};

export default async function Verify2FAPage() {
  const pending = await getPending2FASession();
  if (!pending) redirect("/login");

  return (
    <AuthShell>
      <VerifyTwoFactorForm />
    </AuthShell>
  );
}
