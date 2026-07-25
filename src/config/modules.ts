import {
  KeyRound,
  Monitor,
  Network,
  Package,
  Shield,
  StickyNote,
  Users,
  FileText,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the nine record modules. Everything generic —
 * custom fields, categories, tags, attachments, record notes, the activity
 * timeline, quick-add, and global search — is keyed off `ModuleKey` so
 * adding a tenth module later never means touching the shared engine.
 */
export const MODULE_KEYS = [
  "employees",
  "systems",
  "credentials",
  "software",
  "network",
  "documents",
  "notes",
  "tasks",
  "vpn",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  singular: string;
  icon: LucideIcon;
  href: string;
  description: string;
}

export const MODULES: Record<ModuleKey, ModuleConfig> = {
  employees: {
    key: "employees",
    label: "Employees",
    singular: "Employee",
    icon: Users,
    href: "/employees",
    description: "Directory, departments and system allocation.",
  },
  systems: {
    key: "systems",
    label: "Systems",
    singular: "System",
    icon: Monitor,
    href: "/systems",
    description: "Asset registry with specs, warranty and history.",
  },
  credentials: {
    key: "credentials",
    label: "Credentials",
    singular: "Credential",
    icon: KeyRound,
    href: "/credentials",
    description: "Encrypted vault for every login your team relies on.",
  },
  software: {
    key: "software",
    label: "Software",
    singular: "Software",
    icon: Package,
    href: "/software",
    description: "Licenses, versions and expiry dates.",
  },
  network: {
    key: "network",
    label: "Network",
    singular: "Network",
    icon: Network,
    href: "/network",
    description: "WiFi, router and ISP configuration.",
  },
  documents: {
    key: "documents",
    label: "Documents",
    singular: "Document",
    icon: FileText,
    href: "/documents",
    description: "Invoices, warranties, drivers and manuals.",
  },
  notes: {
    key: "notes",
    label: "Notes",
    singular: "Note",
    icon: StickyNote,
    href: "/notes",
    description: "Procedures, configs and important contacts.",
  },
  tasks: {
    key: "tasks",
    label: "Tasks",
    singular: "Task",
    icon: ListChecks,
    href: "/tasks",
    description: "A todo list with priority, due dates and reminders.",
  },
  vpn: {
    key: "vpn",
    label: "VPN Details",
    singular: "VPN Credential",
    icon: Shield,
    href: "/vpn",
    description: "VPN accounts and credentials.",
  },
};

export const MODULE_LIST: ModuleConfig[] = MODULE_KEYS.map((k) => MODULES[k]);

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}
