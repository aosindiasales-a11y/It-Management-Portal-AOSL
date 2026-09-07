/** Limits + header mapping for the Employees bulk-import feature. */

export const MAX_IMPORT_FILE_SIZE_MB = 5;
export const MAX_IMPORT_FILE_SIZE_BYTES = MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024;

/** Data rows (excluding the header row) accepted in a single import file. */
export const MAX_IMPORT_ROWS = 2000;

export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"];

/**
 * The example row shipped in the downloadable template is recognized by
 * this email and always skipped ("SAMPLE"), so it can never be imported
 * even if an admin forgets to delete it before uploading.
 */
export const TEMPLATE_SAMPLE_EMAIL = "jane.doe@example.com";

/** Canonical import fields, keyed the same way as EmployeeFormValues core fields. */
export type ImportField = "name" | "department" | "email" | "phone" | "joiningDate" | "status" | "category" | "notes";

/**
 * Accepted header text per field (case/space/punctuation-insensitive — see
 * normalizeHeader in parse.ts). Order matters only for the template file.
 */
export const IMPORT_FIELD_HEADERS: Record<ImportField, string[]> = {
  name: ["Full Name", "Name", "Employee Name"],
  department: ["Department", "Dept"],
  email: ["Email", "Email Address", "Work Email"],
  phone: ["Phone", "Phone Number", "Phone No", "Mobile", "Mobile Number", "Contact Number", "Contact No"],
  joiningDate: ["Joining Date", "Date Of Joining", "DOJ", "Join Date"],
  status: ["Status"],
  category: ["Category"],
  notes: ["Notes", "Remarks"],
};

export const IMPORT_TEMPLATE_COLUMNS: { field: ImportField; header: string; required: boolean }[] = [
  { field: "name", header: "Full Name", required: true },
  { field: "department", header: "Department", required: true },
  { field: "email", header: "Email", required: true },
  { field: "phone", header: "Phone", required: false },
  { field: "joiningDate", header: "Joining Date", required: true },
  { field: "status", header: "Status", required: false },
  { field: "category", header: "Category", required: false },
  { field: "notes", header: "Notes", required: false },
];
