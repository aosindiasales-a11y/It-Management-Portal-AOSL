import type { Metadata } from "next";

import { getDocuments } from "@/features/documents/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { DocumentsView } from "@/features/documents/components/documents-view";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const [documents, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getDocuments(true),
    getCategories("documents"),
    getAllTags(),
    getModuleTagMap("documents"),
    getCustomFieldDefs("documents"),
  ]);

  return (
    <DocumentsView
      documents={documents}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
