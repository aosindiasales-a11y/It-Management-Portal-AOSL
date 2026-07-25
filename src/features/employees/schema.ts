import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "RESIGNED", "INACTIVE"] as const;

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  department: z.string().trim().min(1, "Department is required").max(60),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  joiningDate: z.string().min(1, "Joining date is required"),
  status: z.enum(EMPLOYEE_STATUSES),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export const EMPLOYEE_DEFAULTS: EmployeeFormValues = {
  name: "",
  department: "",
  email: "",
  phone: "",
  joiningDate: "",
  status: "ACTIVE",
  categoryId: null,
  notes: "",
  tagIds: [],
  customFields: {},
};
