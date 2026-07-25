import "server-only";

import { prisma } from "@/lib/prisma";
import { getTransporter, getFromAddress, isSmtpConfigured } from "@/lib/mail/transporter";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Attributes the send to an admin record in the Audit Logs — omit for un-attributable sends. */
  context?: { adminId: string; label: string };
}

export interface SendMailResult {
  success: boolean;
  error?: string;
  /** True when SMTP simply isn't configured (missing env vars) rather than a real delivery failure. */
  skipped?: boolean;
}

async function logDelivery(input: SendMailInput, success: boolean, detail?: string): Promise<void> {
  if (!input.context) return;
  await prisma.activityLog.create({
    data: {
      action: success ? "email_sent" : "email_failed",
      entityType: "Admin",
      entityId: input.context.adminId,
      entityLabel: input.context.label,
      description: success
        ? `Sent "${input.subject}" to ${input.to}`
        : `Failed to send "${input.subject}" to ${input.to}${detail ? ` — ${detail}` : ""}`,
      adminId: input.context.adminId,
    },
  });
}

/** The one place every outbound email goes through — SMTP config, logging, and graceful failure handling live here so callers never touch nodemailer directly. */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!isSmtpConfigured()) {
    console.warn(`[mail] SMTP not configured — skipped "${input.subject}" to ${input.to}`);
    await logDelivery(input, false, "SMTP not configured");
    return {
      success: false,
      skipped: true,
      error: "Email delivery isn't configured yet — add SMTP_HOST, SMTP_USER and SMTP_PASSWORD to .env.",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    await logDelivery(input, false, "Could not build transporter");
    return { success: false, error: "Could not build the mail transporter." };
  }

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    console.log(`[mail] Sent "${input.subject}" to ${input.to}`);
    await logDelivery(input, true);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending email.";
    console.error(`[mail] Failed to send "${input.subject}" to ${input.to}:`, message);
    await logDelivery(input, false, message);
    return {
      success: false,
      error: "We couldn't send that email right now. Please try again in a few minutes.",
    };
  }
}
