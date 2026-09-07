import { z } from "zod";

import { customFieldValuesSchema } from "@/lib/custom-fields/schema";

export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "RESIGNED", "INACTIVE"] as const;

/** The exact phrase an admin must type to enable "Delete All Employees" — see delete-all-employees-dialog.tsx and deleteAllEmployees(). */
export const DELETE_ALL_CONFIRMATION_PHRASE = "DELETE ALL EMPLOYEES";

/** Local calendar date (not UTC) so "today" in the browser's timezone is never rejected as a future date. */
function todayLocalDateString(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export const employeeSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required.").max(50),
  name: z.string().trim().min(1, "Employee Name is required.").max(120),
  department: z.string().trim().min(1, "Department is required").max(60),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  dateOfBirth: z
    .string()
    .min(1, "Date of Birth is required.")
    .refine((val) => !Number.isNaN(Date.parse(val)), "Please enter a valid Date of Birth.")
    .refine((val) => val <= todayLocalDateString(), "Date of Birth cannot be in the future."),
  joiningDate: z.string().min(1, "Joining date is required"),
  status: z.enum(EMPLOYEE_STATUSES),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string()).default([]),
  customFields: customFieldValuesSchema.default({}),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export const EMPLOYEE_DEFAULTS: EmployeeFormValues = {
  employeeId: "",
  name: "",
  department: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  joiningDate: "",
  status: "ACTIVE",
  categoryId: null,
  notes: "",
  tagIds: [],
  customFields: {},
};
