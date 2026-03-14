import { gh, getFields, getProjectId } from "@pulse-oracle/sdk";
import type { AddOpts } from "@pulse-oracle/sdk";
import { getContext } from "../config";
import { add } from "./add";

export async function start(title: string, opts: AddOpts = {}) {
  const ctx = getContext();
  const raw = opts.oracle || "Pulse";
  const oracle = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  // Create issue + add to board (returns item ID)
  const itemId = await add(title, { ...opts, oracle });
  if (!itemId) {
    console.error("  Could not get board item ID");
    return;
  }

  // Set Status=In Progress + Oracle on the board
  const fields = await getFields(ctx);
  const projectId = await getProjectId(ctx);

  const fieldMap: Record<string, string> = {
    Status: "In Progress",
    Oracle: oracle,
  };
  if (opts.priority) fieldMap.Priority = opts.priority;

  for (const [name, value] of Object.entries(fieldMap)) {
    const field = fields.find(f => f.name === name);
    if (!field?.options) continue;
    const opt = field.options.find(o => o.name.toLowerCase() === value.toLowerCase());
    if (!opt) continue;
    await gh(
      "project", "item-edit", "--project-id", projectId,
      "--id", itemId, "--field-id", field.id,
      "--single-select-option-id", opt.id,
    );
  }

  console.log(`\n  Started: "${title}" — In Progress, Oracle=${oracle}`);
}
