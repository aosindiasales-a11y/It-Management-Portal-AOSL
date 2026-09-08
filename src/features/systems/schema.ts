import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const SYSTEM_STATUSES = ["ALLOCATED", "VACANT", "REPAIR", "RETIRED"] as const;

export const ASSET_TYPES = ["Laptop", "Desktop", "Other"] as const;

/** Tri-state accessory tracking — "Yes" | "No" | null. `null` means "not specified" and must never be treated as "No". */
export const YES_NO_VALUES = ["Yes", "No"] as const;
const yesNoSchema = z.enum(YES_NO_VALUES).nullable().optional();

export const systemSchema = z.object({
  assetId: z.string().trim().min(1, "Asset Code is required").max(60),
  name: z.string().trim().min(1, "System name is required").max(120),
  assetType: z.string().trim().max(30).optional().or(z.literal("")),
  serialNumber: z.string().trim().max(80).optional().or(z.literal("")),
  manufacturer: z.string().trim().max(60).optional().or(z.literal("")),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  processor: z.string().trim().max(80).optional().or(z.literal("")),
  ram: z.string().trim().max(30).optional().or(z.literal("")),
  storage: z.string().trim().max(30).optional().or(z.literal("")),
  osVersion: z.string().trim().max(60).optional().or(z.literal("")),
  officeVersion: z.string().trim().max(60).optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  warrantyExpiry: z.string().optional().or(z.literal("")),
  status: z.enum(SYSTEM_STATUSES),
  keyboard: yesNoSchema,
  mousePad: yesNoSchema,
  charger: yesNoSchema,
  categoryId: z.string().nullable().optional(),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  assignedEmployeeId: z.string().nullable().optional(),
  credentialId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type SystemFormValues = z.infer<typeof systemSchema>;

export const SYSTEM_DEFAULTS: SystemFormValues = {
  assetId: "",
  name: "",
  assetType: "",
  serialNumber: "",
  manufacturer: "",
  model: "",
  processor: "",
  ram: "",
  storage: "",
  osVersion: "",
  officeVersion: "",
  purchaseDate: "",
  warrantyExpiry: "",
  status: "VACANT",
  keyboard: null,
  mousePad: null,
  charger: null,
  categoryId: null,
  location: "",
  notes: "",
  assignedEmployeeId: null,
  credentialId: null,
  tagIds: [],
  customFields: {},
};
