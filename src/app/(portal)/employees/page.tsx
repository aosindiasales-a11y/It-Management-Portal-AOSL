import type { Metadata } from "next";

import { getEmployees } from "@/features/employees/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { EmployeesView } from "@/features/employees/components/employees-view";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const [employees, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getEmployees(true),
    getCategories("employees"),
    getAllTags(),
    getModuleTagMap("employees"),
    getCustomFieldDefs("employees"),
  ]);

  return (
    <EmployeesView
      employees={employees}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
