import { getItems } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function triage() {
  const items = await getItems(getContext());

  const missing = items
    .map((item, i) => ({ item, rawIndex: i + 1 }))
    .filter(({ item }) => !item.priority || !item.client || !item.oracle);

  if (missing.length === 0) {
    console.log("  All items have Priority, Client, and Oracle set.");
    return;
  }

  console.log(`\n  Pulse — Triage  (${missing.length} items need metadata)\n`);
  console.log(
    "  #".padEnd(6) + "Title".padEnd(48) + "Pri".padEnd(5) + "Client".padEnd(11) + "Oracle"
  );
  console.log("  " + "─".repeat(80));

  for (const { item, rawIndex } of missing) {
    const title = item.title.slice(0, 45).padEnd(45);
    const pri = (item.priority || "---").padEnd(5);
    const client = (item.client || "---").padEnd(11);
    const oracle = item.oracle || "---";

    console.log(
      `  ${String(rawIndex).padStart(3)}  ${title}  ${pri}${client}${oracle}`
    );
  }
  console.log();
}
