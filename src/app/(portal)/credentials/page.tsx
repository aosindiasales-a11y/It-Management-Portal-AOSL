import type { Metadata } from "next";

import { getCredentials } from "@/features/credentials/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { CredentialsView } from "@/features/credentials/components/credentials-view";

export const metadata: Metadata = { title: "Credentials" };

export default async function CredentialsPage() {
  const [credentials, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getCredentials(true),
    getCategories("credentials"),
    getAllTags(),
    getModuleTagMap("credentials"),
    getCustomFieldDefs("credentials"),
  ]);

  return (
    <CredentialsView
      credentials={credentials}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
