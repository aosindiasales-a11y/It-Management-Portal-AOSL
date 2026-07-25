import "server-only";

import { verifySmtpConnection, isSmtpConfigured } from "@/lib/mail/transporter";

/**
 * Verifies the SMTP connection once per server process and logs the result
 * — the "at startup" check the mail service needs. Not called from
 * instrumentation.ts: this project's middleware.ts puts Next.js into
 * edge-compiling instrumentation.ts too, and nodemailer isn't edge-safe.
 * Called instead from the portal layout (Node-only Server Component); the
 * module-level flag below means it still only runs once per process,
 * effectively the same as a startup hook for a long-running Next.js server.
 */
let checked = false;

export function ensureSmtpVerifiedOnce(): void {
  if (checked) return;
  checked = true;

  if (!isSmtpConfigured()) {
    console.warn("[mail] SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — emails will fall back to on-screen links until it is.");
    return;
  }

  verifySmtpConnection().then((result) => {
    if (result.ok) {
      console.log(`[mail] SMTP connection verified (${process.env.SMTP_HOST}).`);
    } else {
      console.error(`[mail] SMTP connection failed: ${result.error}`);
    }
  });
}
