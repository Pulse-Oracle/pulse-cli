import { fmtBoardDates } from "../format";
import { filterItems, groupByPriority } from "../filter";
import { getItems } from "../github";

export async function board(filter?: string) {
  let items = await getItems();
  if (filter) items = filterItems(items, filter);

  const groups = groupByPriority(items);
  const label = filter ? `Master Board — ${filter}` : "Master Board";
  console.log(`\n  Pulse — ${label}  (${items.length} items)\n`);
  console.log(
    "  #  Title                                          Pri  Client    Oracle   Status      Dates"
  );
  console.log("  " + "─".repeat(110));

  let n = 1;
  for (const group of groups) {
    for (const item of group) {
      const title = item.title.slice(0, 45).padEnd(45);
      const pri = (item.priority || "-").padEnd(3);
      const client = (item.client || "-").padEnd(9);
      const oracle = (item.oracle || "-").padEnd(7);
      const status = (item.status || "-").padEnd(11);
      const dates = fmtBoardDates(item["start date"] || "", item["target date"] || "");
      console.log(
        `  ${String(n).padStart(2)}  ${title}  ${pri}  ${client}  ${oracle}  ${status}  ${dates}`
      );
      n++;
    }
  }
  console.log();
}
