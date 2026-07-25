import type { Metadata } from "next";

import { getNetworkConfigs } from "@/features/network/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { NetworkView } from "@/features/network/components/network-view";

export const metadata: Metadata = { title: "Network" };

export default async function NetworkPage() {
  const [configs, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getNetworkConfigs(true),
    getCategories("network"),
    getAllTags(),
    getModuleTagMap("network"),
    getCustomFieldDefs("network"),
  ]);

  return (
    <NetworkView
      configs={configs}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
