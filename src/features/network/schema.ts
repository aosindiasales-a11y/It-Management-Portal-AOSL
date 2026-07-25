import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const networkSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  wifiName: z.string().trim().max(100).optional().or(z.literal("")),
  wifiPassword: z.string().max(200).optional().or(z.literal("")), // blank on edit = keep current
  routerIp: z.string().trim().max(60).optional().or(z.literal("")),
  gateway: z.string().trim().max(60).optional().or(z.literal("")),
  dns: z.string().trim().max(120).optional().or(z.literal("")),
  isp: z.string().trim().max(80).optional().or(z.literal("")),
  bandwidth: z.string().trim().max(40).optional().or(z.literal("")),
  routerLoginUser: z.string().trim().max(80).optional().or(z.literal("")),
  routerLoginPass: z.string().trim().max(80).optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type NetworkFormValues = z.infer<typeof networkSchema>;

export const NETWORK_DEFAULTS: NetworkFormValues = {
  label: "",
  wifiName: "",
  wifiPassword: "",
  routerIp: "",
  gateway: "",
  dns: "",
  isp: "",
  bandwidth: "",
  routerLoginUser: "",
  routerLoginPass: "",
  categoryId: null,
  notes: "",
  tagIds: [],
  customFields: {},
};
