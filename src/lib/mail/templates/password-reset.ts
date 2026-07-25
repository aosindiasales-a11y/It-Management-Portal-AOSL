import "server-only";

import { renderEmailLayout, emailButton, escapeHtml } from "@/lib/mail/templates/layout";
import { RESET_TOKEN_TTL_MINUTES } from "@/lib/auth/password-reset";

export function buildPasswordResetEmail(params: { name: string; resetUrl: string }) {
  const { name, resetUrl } = params;
  const subject = "Reset your IT Manager Portal password";

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>
    <p style="margin: 0 0 12px;">We received a request to reset your IT Manager Portal password. Click the button below to choose a new one — this link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.</p>
    ${emailButton("Reset password", resetUrl)}
    <p style="margin: 16px 0 0; font-size: 12px; color: #64748b; word-break: break-all;">Or paste this link into your browser:<br />${escapeHtml(resetUrl)}</p>
    <p style="margin: 16px 0 0;">If you didn't request this, your password is still safe — just ignore this email.</p>
  `;
  const bodyText = `Hi ${name},\n\nWe received a request to reset your IT Manager Portal password. Use the link below to choose a new one — it expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.\n\n${resetUrl}\n\nIf you didn't request this, your password is still safe — just ignore this email.`;

  const { html, text } = renderEmailLayout({
    previewText: "Reset your IT Manager Portal password",
    heading: "Reset your password",
    bodyHtml,
    bodyText,
  });

  return { subject, html, text };
}
