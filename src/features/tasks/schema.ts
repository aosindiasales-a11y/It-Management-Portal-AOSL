import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().max(2000).optional().or(z.literal("")),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.string().optional().or(z.literal("")),
  reminderAt: z.string().optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export const TASK_DEFAULTS: TaskFormValues = {
  title: "",
  description: "",
  priority: "MEDIUM",
  dueDate: "",
  reminderAt: "",
  categoryId: null,
  completed: false,
  tagIds: [],
  customFields: {},
};
