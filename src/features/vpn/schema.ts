import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const VPN_STATUSES = ["Enabled", "Disabled"] as const;
export const VPN_ACCOUNT_TYPES = ["Standard", "Administrator"] as const;

export const vpnSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  username: z.string().trim().max(100).optional().or(z.literal("")),
  password: z.string().max(300).optional().or(z.literal("")), // blank on edit = keep current
  mailId: z.string().trim().max(150).optional().or(z.literal("")),
  status: z.enum(VPN_STATUSES).default("Enabled"),
  active: z.boolean().default(true),
  accountType: z.enum(VPN_ACCOUNT_TYPES).default("Standard"),
  categoryId: z.string().nullable().optional(),
  customFields: customFieldValuesSchema.default({}),
});

export type VpnFormValues = z.infer<typeof vpnSchema>;

export const VPN_DEFAULTS: VpnFormValues = {
  name: "",
  username: "",
  password: "",
  mailId: "",
  status: "Enabled",
  active: true,
  accountType: "Standard",
  categoryId: null,
  customFields: {},
};
