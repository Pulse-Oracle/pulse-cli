import type { ProjectItem } from "./types";

/** Filter items by oracle, client, priority, status, or repo (case-insensitive) */
export function filterItems(items: ProjectItem[], filter: string): ProjectItem[] {
  const f = filter.toLowerCase();
  return items.filter(
    (i) =>
      (i.oracle || "").toLowerCase() === f ||
      (i.client || "").toLowerCase() === f ||
      (i.priority || "").toLowerCase() === f ||
      (i.status || "").toLowerCase().replace(" ", "") === f.replace(" ", "") ||
      (i.repo || "").toLowerCase() === f
  );
}

/** Group items by priority: P0, P1, P2, no priority */
export function groupByPriority(items: ProjectItem[]): ProjectItem[][] {
  return [
    items.filter((i) => i.priority === "P0"),
    items.filter((i) => i.priority === "P1"),
    items.filter((i) => i.priority === "P2"),
    items.filter((i) => !i.priority),
  ];
}
