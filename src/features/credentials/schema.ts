import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const credentialSchema = z.object({
  platform: z.string().trim().min(1, "Platform is required").max(100),
  url: z.string().trim().max(300).optional().or(z.literal("")),
  username: z.string().trim().max(150).optional().or(z.literal("")),
  password: z.string().max(300).optional().or(z.literal("")), // blank on edit = keep current
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type CredentialFormValues = z.infer<typeof credentialSchema>;

export const CREDENTIAL_DEFAULTS: CredentialFormValues = {
  platform: "",
  url: "",
  username: "",
  password: "",
  categoryId: null,
  notes: "",
  tagIds: [],
  customFields: {},
};
