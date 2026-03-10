import { gh, getItems, getFields, getProjectId } from "@pulse-oracle/sdk";
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

  for (const fv of fieldValues) {
    let fieldName: string | undefined;
    let value: string;

    if (fv.includes("=")) {
      [fieldName, value] = fv.split("=", 2);
    } else {
      value = fv;
    }

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
        break;
      }
    }
  }
}
