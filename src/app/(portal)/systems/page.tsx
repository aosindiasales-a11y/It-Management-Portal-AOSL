import type { Metadata } from "next";

import { getSystems } from "@/features/systems/actions";
import { getEmployees } from "@/features/employees/actions";
import { getCredentials } from "@/features/credentials/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { SystemsView } from "@/features/systems/components/systems-view";
import { toSafeCredential } from "@/features/systems/types";

export const metadata: Metadata = { title: "Systems" };

export default async function SystemsPage() {
  const [systems, employees, credentials, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getSystems(true),
    getEmployees(false),
    getCredentials(false),
    getCategories("systems"),
    getAllTags(),
    getModuleTagMap("systems"),
    getCustomFieldDefs("systems"),
  ]);

  return (
    <SystemsView
      systems={systems}
      categories={categories}
      allTags={allTags}
      employees={employees}
      credentials={credentials.map(toSafeCredential)}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
