import { gh, getItems, getFields, getProjectId } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function close(itemIndex: number) {
  const ctx = getContext();
  const items = await getItems(ctx);
  const fields = await getFields(ctx);
  const projectId = await getProjectId(ctx);

  if (itemIndex < 1 || itemIndex > items.length) {
    console.error(`Item index ${itemIndex} out of range (1-${items.length})`);
    process.exit(1);
  }

  const item = items[itemIndex - 1];

  // Set board status to Done
  const statusField = fields.find(f => f.name === "Status");
  const doneOpt = statusField?.options?.find(o => o.name === "Done");

  if (statusField && doneOpt) {
    await gh(
      "project", "item-edit", "--project-id", projectId,
      "--id", item.id, "--field-id", statusField.id,
      "--single-select-option-id", doneOpt.id,
    );
  }

  // Close the GH issue if it has one
  const issueUrl = (item as any).content?.url;
  if (issueUrl) {
    try {
      await gh("issue", "close", issueUrl);
      console.log(`  Closed issue: ${issueUrl}`);
    } catch { /* draft item or inaccessible */ }
  }

  console.log(`  Done: "${item.title}"`);
}
