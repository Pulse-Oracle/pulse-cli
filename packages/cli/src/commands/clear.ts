import { ghJson, graphql, getItems, getProjectId } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function clearDate(itemIndex: number, which: "start" | "target" | "both") {
  const ctx = getContext();
  const items = await getItems(ctx);
  const projectId = await getProjectId(ctx);

  if (itemIndex < 1 || itemIndex > items.length) {
    console.error(`Item index ${itemIndex} out of range (1-${items.length})`);
    return;
  }

  const item = items[itemIndex - 1];
  console.log(`Clearing dates on: "${item.title}"\n`);

  const allFields = await ghJson(
    "project", "field-list", String(ctx.projectNumber), "--owner", ctx.org, "--format", "json"
  );
  const startField = allFields.fields.find((f: any) => f.name === "Start Date");
  const targetField = allFields.fields.find((f: any) => f.name === "Target Date");

  if ((which === "start" || which === "both") && startField) {
    await graphql(`mutation { clearProjectV2ItemFieldValue(input: { projectId: "${projectId}", itemId: "${item.id}", fieldId: "${startField.id}" }) { projectV2Item { id } } }`);
    console.log("  Cleared Start Date");
  }
  if ((which === "target" || which === "both") && targetField) {
    await graphql(`mutation { clearProjectV2ItemFieldValue(input: { projectId: "${projectId}", itemId: "${item.id}", fieldId: "${targetField.id}" }) { projectV2Item { id } } }`);
    console.log("  Cleared Target Date");
  }
}
