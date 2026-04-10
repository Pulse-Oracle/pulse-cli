import { gh, getItems, getFields, getProjectId, graphql } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function set(itemIndex: number, ...fieldValues: string[]) {
  const ctx = getContext();
  const items = await getItems(ctx);
  const fields = await getFields(ctx);
  const projectId = await getProjectId(ctx);

  if (itemIndex < 1 || itemIndex > items.length) {
    console.error(`Item index ${itemIndex} out of range (1-${items.length})`);
    return;
  }

  const item = items[itemIndex - 1];
  console.log(`Setting fields on: "${item.title}"\n`);

  // Tracks bare-date args for positional Start/Target assignment:
  //   pulse set 65 2026-04-10 2026-04-17  →  Start=2026-04-10, Target=2026-04-17
  let dateIndex = 0;

  for (const fv of fieldValues) {
    let fieldName: string | undefined;
    let value: string;

    if (fv.includes("=")) {
      [fieldName, value] = fv.split("=", 2);
    } else {
      value = fv;
    }

    // Try TEXT field first (requires field=value syntax)
    if (fieldName) {
      const textField = fields.find(
        (f) => f.name.toLowerCase() === fieldName!.toLowerCase() && !f.options && f.type === "ProjectV2Field"
      );
      if (textField && !isDateFieldName(textField.name)) {
        await graphql(`mutation {
          updateProjectV2ItemFieldValue(input: {
            projectId: "${projectId}",
            itemId: "${item.id}",
            fieldId: "${textField.id}",
            value: { text: "${value.replace(/"/g, '\\"')}" }
          }) { projectV2Item { id } }
        }`);
        console.log(`  ${textField.name} = ${value}`);
        continue;
      }
    }

    // Try SingleSelect fields
    let matched = false;
    for (const field of fields) {
      if (!field.options) continue;
      if (fieldName && field.name.toLowerCase() !== fieldName.toLowerCase()) continue;

      const opt = field.options.find((o) => o.name.toLowerCase() === value.toLowerCase());
      if (opt) {
        await gh(
          "project", "item-edit", "--project-id", projectId,
          "--id", item.id, "--field-id", field.id,
          "--single-select-option-id", opt.id
        );
        console.log(`  ${field.name} = ${opt.name}`);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Try DATE field (YYYY-MM-DD format).
    // Two ways:
    //   pulse set 65 2026-04-10 2026-04-17           →  positional: 1st bare date = Start, 2nd = Target
    //   pulse set 65 "Start Date=2026-04-10"         →  explicit by field name
    //   pulse set 65 "Target Date=2026-04-17"
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      let dateField;
      if (fieldName) {
        // Explicit field name
        dateField = fields.find(
          (f) => f.name.toLowerCase() === fieldName!.toLowerCase() && f.type === "ProjectV2Field"
        );
      } else {
        // Positional: 1st bare date → Start Date, 2nd → Target Date
        const targetName = dateIndex === 0 ? "Start Date" : "Target Date";
        dateField = fields.find((f) => f.name === targetName);
        dateIndex++;
      }
      if (dateField) {
        await graphql(`mutation {
          updateProjectV2ItemFieldValue(input: {
            projectId: "${projectId}",
            itemId: "${item.id}",
            fieldId: "${dateField.id}",
            value: { date: "${value}" }
          }) { projectV2Item { id } }
        }`);
        console.log(`  ${dateField.name} = ${value}`);
        continue;
      }
    }

    // Nothing matched — warn instead of silently dropping
    console.warn(`  ⚠ "${fv}" did not match any field on this project`);
  }
}

function isDateFieldName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "start date" || lower === "target date";
}
