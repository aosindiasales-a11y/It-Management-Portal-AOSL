import type { Software } from "@prisma/client";

import { formatDate } from "@/lib/utils";
import type { CustomFieldValues } from "@/lib/custom-fields/types";

export interface CredentialFileData {
  name: string;
  email: string;
  password: string;
  licenses: string[];
  portalUrl: string;
  createdAt: string;
}

const FILE_TITLE = "Microsoft 365 Credentials";
const SECURITY_NOTE = "Keep this file secure — it contains a live account password.";

export function buildTxt(data: CredentialFileData): Blob {
  const lines = [
    FILE_TITLE,
    "=".repeat(FILE_TITLE.length),
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Password: ${data.password}`,
    `License: ${data.licenses.join(", ") || "—"}`,
    `Microsoft Portal: ${data.portalUrl || "—"}`,
    `Created: ${data.createdAt}`,
    "",
    SECURITY_NOTE,
  ];
  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
}

export async function buildPdf(data: CredentialFileData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(FILE_TITLE, 14, 20);

  const rows: [string, string][] = [
    ["Name", data.name],
    ["Email", data.email],
    ["Password", data.password],
    ["License", data.licenses.join(", ") || "—"],
    ["Microsoft Portal", data.portalUrl || "—"],
    ["Created", data.createdAt],
  ];

  doc.setFontSize(11);
  let y = 34;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 55, y);
    y += 9;
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(SECURITY_NOTE, 14, y + 6);

  return doc.output("blob");
}

export async function buildDocx(data: CredentialFileData): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  function row(label: string, value: string) {
    return new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)],
    });
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: FILE_TITLE, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          row("Name", data.name),
          row("Email", data.email),
          row("Password", data.password),
          row("License", data.licenses.join(", ") || "—"),
          row("Microsoft Portal", data.portalUrl || "—"),
          row("Created", data.createdAt),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: SECURITY_NOTE, italics: true })] }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type CredentialFileFormat = "pdf" | "docx" | "txt";

/** Single orchestrator for every "Download Credentials" trigger point (table column, row menu, details drawer). */
export async function downloadSoftwareCredentials(
  software: Software,
  customFields: CustomFieldValues,
  format: CredentialFileFormat,
  fetchPassword: () => Promise<string>
): Promise<void> {
  const password = await fetchPassword();
  const data: CredentialFileData = {
    name: software.name,
    email: typeof customFields.mail_id === "string" ? customFields.mail_id : "",
    password,
    licenses: (software.licenseType ?? "").split("+").filter(Boolean),
    portalUrl: software.downloadLink ?? "",
    createdAt: formatDate(software.createdAt),
  };

  const safeName = software.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "user";

  if (format === "txt") {
    triggerDownload(buildTxt(data), `${safeName}-credentials.txt`);
  } else if (format === "pdf") {
    triggerDownload(await buildPdf(data), `${safeName}-credentials.pdf`);
  } else {
    triggerDownload(await buildDocx(data), `${safeName}-credentials.docx`);
  }
}
