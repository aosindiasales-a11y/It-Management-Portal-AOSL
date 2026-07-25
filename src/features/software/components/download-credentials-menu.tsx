"use client";

import type { ReactNode } from "react";
import { FileText, FileType, FileSpreadsheet } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CredentialFileFormat } from "@/features/software/lib/generate-credential-file";

const FORMATS: { format: CredentialFileFormat; label: string; icon: typeof FileText }[] = [
  { format: "pdf", label: "Download PDF", icon: FileText },
  { format: "docx", label: "Download DOCX", icon: FileType },
  { format: "txt", label: "Download TXT", icon: FileSpreadsheet },
];

interface DownloadItemsProps {
  onDownload: (format: CredentialFileFormat) => void;
}

function FormatItems({ onDownload }: DownloadItemsProps) {
  return (
    <>
      {FORMATS.map(({ format, label, icon: Icon }) => (
        <DropdownMenuItem key={format} onSelect={() => onDownload(format)}>
          <Icon />
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** Standalone dropdown — used in the table's Download column and the details drawer's Download button. */
export function DownloadCredentialsDropdown({ onDownload, trigger }: DownloadItemsProps & { trigger: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <FormatItems onDownload={onDownload} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Nested submenu — used inside RowActionsMenu's extraItems, where a new root DropdownMenu can't be opened. */
export function DownloadCredentialsSubmenu({ onDownload }: DownloadItemsProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
        <FileText />
        Download Credentials
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <FormatItems onDownload={onDownload} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
