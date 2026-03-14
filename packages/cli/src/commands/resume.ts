import { gh, getItems, getFields, getProjectId } from "@pulse-oracle/sdk";
import { getContext } from "../config";
import { mawWake, mawHey } from "../maw";

export async function resume(itemIndex: number) {
  const ctx = getContext();
  const items = await getItems(ctx);

  if (itemIndex < 1 || itemIndex > items.length) {
    console.error(`Item index ${itemIndex} out of range (1-${items.length})`);
    process.exit(1);
  }

  const item = items[itemIndex - 1];
  const oracle = (item.oracle || "").toLowerCase();

  if (!oracle) {
    console.error(`Item "${item.title}" has no Oracle assigned.`);
    process.exit(1);
  }

  console.log(`Resuming: "${item.title}" → ${oracle}`);

  const slug = item.title
    .replace(/^\[P\d\]\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  const result = await mawWake(oracle, { task: slug });
  if (!result) {
    console.error(`Failed to wake ${oracle}. Try: maw wake ${oracle} --new ${slug}`);
    process.exit(1);
  }

  const issueUrl = (item as any).content?.url;

  await new Promise(r => setTimeout(r, 4000));

  const prompt = issueUrl
    ? `You were working on ${issueUrl} — review your progress and continue where you left off. Post a status comment on the issue.`
    : `Resume work on: "${item.title}". Review your progress and continue.`;

  const target = `${oracle}-${slug}`;
  await mawHey(target, prompt);

  // Set board status back to In Progress
  const fields = await getFields(ctx);
  const projectId = await getProjectId(ctx);
  const statusField = fields.find(f => f.name === "Status");
  const inProgressOpt = statusField?.options?.find(o => o.name === "In Progress");

  if (statusField && inProgressOpt) {
    await gh(
      "project", "item-edit", "--project-id", projectId,
      "--id", item.id, "--field-id", statusField.id,
      "--single-select-option-id", inProgressOpt.id,
    );
  }

  if (issueUrl) {
    try {
      await gh("issue", "comment", issueUrl, "--body",
        `Agent resumed on \`${oracle}\` worktree \`${slug}\`.\n\n_Resumed by \`pulse resume\`_`
      );
    } catch { /* ok */ }
  }

  console.log(`\n  Resumed: "${item.title}"`);
  console.log(`  Agent:   ${target}`);
  console.log(`  Status:  In Progress`);
  if (issueUrl) console.log(`  Issue:   ${issueUrl}`);
  console.log();
}
