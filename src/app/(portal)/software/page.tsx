import type { Metadata } from "next";

import { getSoftwareList } from "@/features/software/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { SoftwareView } from "@/features/software/components/software-view";

export const metadata: Metadata = { title: "Microsoft 365 User Details" };

export default async function SoftwarePage() {
  const [softwareList, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getSoftwareList(true),
    getCategories("software"),
    getAllTags(),
    getModuleTagMap("software"),
    getCustomFieldDefs("software"),
  ]);

  return (
    <SoftwareView
      softwareList={softwareList}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
