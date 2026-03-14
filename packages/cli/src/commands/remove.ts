import { gh, getItems } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function remove(itemIndex: number) {
  const ctx = getContext();
  const items = await getItems(ctx);

  if (itemIndex < 1 || itemIndex > items.length) {
    console.error(`Item index ${itemIndex} out of range (1-${items.length})`);
    process.exit(1);
  }

  const item = items[itemIndex - 1];

  await gh(
    "project", "item-delete", String(ctx.projectNumber),
    "--owner", ctx.org,
    "--id", item.id,
  );

  console.log(`  Removed from board: "${item.title}"`);
}
