import type { Metadata } from "next";

import { getTasks } from "@/features/tasks/actions";
import { getCategories } from "@/features/categories/actions";
import { getAllTags, getModuleTagMap } from "@/features/tags/actions";
import { getCustomFieldDefs } from "@/features/custom-fields/actions";
import { TasksView } from "@/features/tasks/components/tasks-view";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const [tasks, categories, allTags, tagMap, customFieldDefs] = await Promise.all([
    getTasks(true),
    getCategories("tasks"),
    getAllTags(),
    getModuleTagMap("tasks"),
    getCustomFieldDefs("tasks"),
  ]);

  return (
    <TasksView
      tasks={tasks}
      categories={categories}
      allTags={allTags}
      tagMap={tagMap}
      customFieldDefs={customFieldDefs}
    />
  );
}
