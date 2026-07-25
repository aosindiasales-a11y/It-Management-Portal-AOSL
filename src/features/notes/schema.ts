import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  content: z.string().max(20000).optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
  pinned: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type NoteFormValues = z.infer<typeof noteSchema>;

export const NOTE_DEFAULTS: NoteFormValues = {
  title: "",
  content: "",
  categoryId: null,
  pinned: false,
  tagIds: [],
  customFields: {},
};
