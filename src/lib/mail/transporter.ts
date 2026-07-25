import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Single nodemailer transporter for the whole app, built from SMTP_* env
 * vars (Microsoft 365 / Office 365 by default — smtp.office365.com:587,
 * STARTTLS). Never hardcode credentials here; everything comes from .env.
 */

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !password || !fromEmail) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user,
    password,
    fromName: process.env.SMTP_FROM_NAME || "IT Manager Portal",
    fromEmail,
  };
}

export function isSmtpConfigured(): boolean {
  return readSmtpConfig() !== null;
}

export function getFromAddress(): string {
  const config = readSmtpConfig();
  if (!config) return "IT Manager Portal <no-reply@localhost>";
  return `"${config.fromName}" <${config.fromEmail}>`;
}

let cachedTransporter: Transporter | null = null;
let cachedConfigKey: string | null = null;

/** Lazily builds (and caches) the transporter — reads env fresh each call so a changed .env takes effect on next send without a rebuild. */
function getTransporter(): Transporter | null {
  const config = readSmtpConfig();
  if (!config) return null;

  const configKey = `${config.host}:${config.port}:${config.user}`;
  if (cachedTransporter && cachedConfigKey === configKey) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // false for STARTTLS on 587, true for implicit TLS on 465
    requireTLS: !config.secure, // enforce STARTTLS rather than allowing a silent plaintext fallback
    auth: { user: config.user, pass: config.password },
  });
  cachedConfigKey = configKey;

  return cachedTransporter;
}

export interface SmtpVerifyResult {
  ok: boolean;
  error?: string;
}

/** Verifies the SMTP connection/credentials — called at app startup and safe to call anytime. */
export async function verifySmtpConnection(): Promise<SmtpVerifyResult> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP is not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — emails will not be sent." };
  }

  const transporter = getTransporter();
  if (!transporter) return { ok: false, error: "Could not build an SMTP transporter." };

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown SMTP connection error." };
  }
}

export { getTransporter };
