import "server-only";

import { renderEmailLayout, escapeHtml } from "@/lib/mail/templates/layout";

export function buildSecurityAlertEmail(params: { name: string; title: string; message: string; occurredAt?: Date }) {
  const { name, title, message, occurredAt = new Date() } = params;
  const subject = `Security alert: ${title}`;
  const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(occurredAt);

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>
    <p style="margin: 0 0 12px;">${escapeHtml(message)}</p>
    <p style="margin: 0 0 12px; font-size: 12px; color: #64748b;">${escapeHtml(when)}</p>
    <p style="margin: 16px 0 0;">If this wasn't you, sign in and change your password immediately, or contact your IT administrator.</p>
  `;
  const bodyText = `Hi ${name},\n\n${message}\n\n${when}\n\nIf this wasn't you, sign in and change your password immediately, or contact your IT administrator.`;

  const { html, text } = renderEmailLayout({
    previewText: message,
    heading: title,
    bodyHtml,
    bodyText,
  });

  return { subject, html, text };
}
