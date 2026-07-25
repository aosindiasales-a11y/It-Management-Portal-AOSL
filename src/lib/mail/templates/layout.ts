import "server-only";

/**
 * Shared AOSL-branded HTML shell for every transactional email. Uses a
 * table-based layout (not flexbox/grid) and inline styles throughout —
 * the only markup that reliably renders the same across Outlook, Gmail,
 * Apple Mail, etc. No remote images (avoids "images blocked" placeholder
 * boxes in clients like Outlook that hide external images by default);
 * the AOSL wordmark is rendered as styled text instead.
 */

const BRAND_PRIMARY = "#1667da";
const BRAND_GOLD = "#f2b926";
const BRAND_INK = "#0f172a";
const BRAND_MUTED = "#64748b";
const BRAND_BORDER = "#e2e8f0";
const BRAND_BG = "#f1f5f9";

export interface EmailBody {
  /** Short preview shown in inbox lists before the email is opened. */
  previewText: string;
  heading: string;
  /** Inner content — a series of <p>/<div> blocks; buttons via `emailButton()`. */
  bodyHtml: string;
  bodyText: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="border-radius: 8px; background-color: ${BRAND_PRIMARY};">
          <a href="${href}" target="_blank" style="display: inline-block; padding: 12px 28px; font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function emailCode(code: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td align="center" style="background-color: ${BRAND_BG}; border: 1px solid ${BRAND_BORDER}; border-radius: 10px; padding: 20px;">
          <span style="font-family: 'SF Mono', 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${BRAND_INK};">
            ${escapeHtml(code)}
          </span>
        </td>
      </tr>
    </table>
  `;
}

export function renderEmailLayout({ previewText, heading, bodyHtml, bodyText }: EmailBody): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BRAND_BG}; font-family: -apple-system, Segoe UI, Roboto, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(previewText)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND_BG}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid ${BRAND_BORDER};">
            <tr>
              <td style="padding: 28px 32px; border-bottom: 3px solid ${BRAND_GOLD}; background-color: ${BRAND_INK};">
                <span style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">AVIATION OVERSEAS SUPPLY LOGISTICS</span>
                <div style="margin-top: 2px; font-size: 12px; font-weight: 500; color: ${BRAND_GOLD};">IT MANAGER PORTAL</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${BRAND_INK};">${escapeHtml(heading)}</h1>
                <div style="font-size: 14px; line-height: 1.6; color: ${BRAND_INK};">
                  ${bodyHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color: ${BRAND_BG}; border-top: 1px solid ${BRAND_BORDER};">
                <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${BRAND_MUTED};">
                  This is an automated message from the IT Manager Portal at Aviation Overseas Supply Logistics Pvt. Ltd.
                  If you didn't expect this email, you can safely ignore it or contact IT support.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `AVIATION OVERSEAS SUPPLY LOGISTICS — IT MANAGER PORTAL\n\n${heading}\n\n${bodyText}\n\n---\nThis is an automated message. If you didn't expect this email, you can safely ignore it or contact IT support.`;

  return { html, text };
}
