import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const documentMetaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type DocumentMetaValues = z.infer<typeof documentMetaSchema>;

export const DOCUMENT_DEFAULTS: DocumentMetaValues = {
  title: "",
  categoryId: null,
  notes: "",
  tagIds: [],
  customFields: {},
};
