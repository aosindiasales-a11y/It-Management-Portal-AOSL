import "server-only";

import { renderEmailLayout, emailCode, escapeHtml } from "@/lib/mail/templates/layout";

export function buildLoginOtpEmail(params: { name: string; code: string; expiresInMinutes: number }) {
  const { name, code, expiresInMinutes } = params;
  const subject = `Your sign-in code: ${code}`;

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>
    <p style="margin: 0 0 12px;">Use this code to finish signing in to the IT Manager Portal. It expires in ${expiresInMinutes} minutes and can only be used once.</p>
    ${emailCode(code)}
    <p style="margin: 16px 0 0;">If you didn't try to sign in, change your password immediately and consider enabling two-factor authentication in Settings.</p>
  `;
  const bodyText = `Hi ${name},\n\nUse this code to finish signing in to the IT Manager Portal: ${code}\n\nIt expires in ${expiresInMinutes} minutes and can only be used once.\n\nIf you didn't try to sign in, change your password immediately.`;

  const { html, text } = renderEmailLayout({
    previewText: `Your sign-in code is ${code}`,
    heading: "Your sign-in code",
    bodyHtml,
    bodyText,
  });

  return { subject, html, text };
}
