import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const softwareSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  version: z.string().trim().max(40).optional().or(z.literal("")),
  licenseKey: z.string().trim().max(200).optional().or(z.literal("")),
  licenseType: z.string().trim().max(60).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  downloadLink: z.string().trim().max(300).optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
  // Top-level, not part of customFields — the encrypted payload it becomes
  // ({ciphertext,iv,authTag}) can't legally live in the generic CustomFieldValue
  // union. Blank on edit = keep the current password.
  password: z.string().max(300).optional().or(z.literal("")),
});

export type SoftwareFormValues = z.infer<typeof softwareSchema>;

export const SOFTWARE_DEFAULTS: SoftwareFormValues = {
  name: "",
  version: "",
  licenseKey: "",
  licenseType: "",
  expiryDate: "",
  downloadLink: "",
  categoryId: null,
  notes: "",
  tagIds: [],
  customFields: {},
  password: "",
};
