import { gh, getFields, getProjectId, ensureLabel } from "@pulse-oracle/sdk";
import type { EscalateOpts } from "@pulse-oracle/sdk";
import { getContext, getOracleRepos, LABEL_COLORS } from "../config";
import { resolveOracle } from "../routing";

export async function escalate(title: string, opts: EscalateOpts = {}) {
  const ctx = getContext();

  // 1. Resolve + normalize target oracle (capitalized for display)
  const raw = opts.oracle || resolveOracle(title).oracle;
  const oracle = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  console.log(`Escalating to: ${oracle}`);

  // 2. Resolve target repo
  const repoName = getOracleRepos()[oracle.toLowerCase()];
  if (!repoName) {
    console.error(`Unknown oracle: "${oracle}". Check oracleRepos in pulse.config.json.`);
    process.exit(1);
  }
  const targetRepo = `${ctx.org}/${repoName}`;

  // 3. Build issue
  const p0Title = title.startsWith("[P0]") ? title : `[P0] ${title}`;
  const bodyLines = [
    `## P0 Escalation`,
    ``,
    `**Assigned Oracle**: ${oracle}`,
    `**Escalated by**: Pulse`,
    `**Time**: ${new Date().toISOString()}`,
  ];
  if (opts.context) {
    bodyLines.push(``, `### Context`, ``, opts.context);
  }
  bodyLines.push(``, `---`, `*Created by \`pulse escalate\`*`);

  // 4. Ensure labels exist
  await ensureLabel(targetRepo, `oracle:${oracle}`, LABEL_COLORS.oracle);
  await ensureLabel(targetRepo, "P0", LABEL_COLORS.p0);

  // 5. Create issue
  const issueUrl = await gh(
    "issue", "create", "--repo", targetRepo,
    "--title", p0Title,
    "--body", bodyLines.join("\n"),
    "--label", `oracle:${oracle},P0`,
  );
  console.log(`Created: ${issueUrl}`);

  // 6. Add to Master Board
  await gh("project", "item-add", String(ctx.projectNumber), "--owner", ctx.org, "--url", issueUrl.trim());
  console.log(`Added to Master Board`);

  // 7. Set Priority=P0, Oracle, Status=In Progress
  await setBoardFields(ctx, issueUrl.trim(), oracle);

  // 8. Output maw commands
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  console.log(`\n  --- Escalation Summary ---`);
  console.log(`  Issue:   ${issueUrl.trim()}`);
  console.log(`  Oracle:  ${oracle}`);
  console.log(`  Repo:    ${targetRepo}`);
  console.log(`  Slug:    ${slug}`);
  console.log(`\n  --- Run these to spawn agent ---`);
  console.log(`  maw wake ${oracle.toLowerCase()} --new ${slug}`);
  console.log(`  maw hey ${oracle.toLowerCase()}-${slug} "${issueUrl.trim()}"`);
  console.log();
}

async function setBoardFields(ctx: { org: string; projectNumber: number }, issueUrl: string, oracle: string) {
  const projectId = await getProjectId(ctx);
  const fields = await getFields(ctx);
  const items = await gh("project", "item-list", String(ctx.projectNumber), "--owner", ctx.org, "--format", "json", "--limit", "100");
  const allItems = JSON.parse(items).items;

  const item = [...allItems].reverse().find((i: any) => i.title?.startsWith("[P0]"));
  if (!item?.id) {
    console.error("  Could not find item on board to set fields");
    return;
  }

  const fieldMap: Record<string, string> = {
    Priority: "P0",
    Oracle: oracle,
    Status: "In Progress",
  };

  for (const [fieldName, value] of Object.entries(fieldMap)) {
    const field = fields.find((f) => f.name === fieldName);
    if (!field?.options) continue;
    const opt = field.options.find((o) => o.name.toLowerCase() === value.toLowerCase());
    if (!opt) continue;
    await gh(
      "project", "item-edit", "--project-id", projectId,
      "--id", item.id, "--field-id", field.id,
      "--single-select-option-id", opt.id,
    );
    console.log(`  ${fieldName} = ${opt.name}`);
  }
}
