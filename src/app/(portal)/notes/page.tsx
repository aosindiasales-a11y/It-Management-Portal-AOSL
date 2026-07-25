import type { Metadata } from "next";

import { getNotes } from "@/features/notes/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { NotesView } from "@/features/notes/components/notes-view";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const [notes, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getNotes(true),
    getCategories("notes"),
    getAllTags(),
    getModuleTagMap("notes"),
    getCustomFieldDefs("notes"),
  ]);

  return (
    <NotesView
      notes={notes}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
