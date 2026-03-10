import { gh, getItems, getFields, getProjectId, route } from "@pulse-oracle/sdk";
import type { RoutingConfig } from "@pulse-oracle/sdk";
import { getContext, loadConfig } from "../config";

export async function autoAssign(opts: { dryRun?: boolean; notify?: boolean } = {}) {
  const ctx = getContext();
  const config = loadConfig();
  const routing = config.routing as RoutingConfig | undefined;

  if (!routing) {
    console.error("  No routing config found in pulse.config.json.");
    console.error("  Add a \"routing\" key with repo/keyword/label/default rules.");
    console.error("  Run `pulse init` to generate a template.\n");
    process.exit(1);
  }

  // Fetch board items + fields
  const items = await getItems(ctx);
  const fields = await getFields(ctx);
  const projectId = await getProjectId(ctx);

  // Find Oracle field
  const oracleField = fields.find((f) => f.name.toLowerCase() === "oracle");
  if (!oracleField || !oracleField.options) {
    console.error("  Oracle field not found on the project board.");
    process.exit(1);
  }

  // Find unassigned items (no oracle set)
  const unassigned = items.filter((i) => !i.oracle);

  if (unassigned.length === 0) {
    console.log("\n  Pulse — Auto-Assign\n");
    console.log("  All items already have an Oracle assigned.\n");
    return;
  }

  console.log(`\n  Pulse — Auto-Assign${opts.dryRun ? " (dry run)" : ""}\n`);
  console.log(`  ${unassigned.length} unassigned items found:\n`);

  // Also scan for untracked issues to add to board first
  const reposJson = await gh("repo", "list", ctx.org, "--json", "name,url,isArchived", "--limit", "100");
  const repos: { name: string; url: string; isArchived: boolean }[] = JSON.parse(reposJson);
  const activeRepos = repos.filter((r) => !r.isArchived);
  const boardTitles = items.map((i) => i.title.toLowerCase());

  // Find untracked issues (not on board yet)
  const untracked: { repo: string; title: string; url: string; labels: string[] }[] = [];

  for (const repo of activeRepos) {
    try {
      const issuesJson = await gh(
        "issue", "list", "--repo", `${ctx.org}/${repo.name}`,
        "--state", "open", "--json", "title,url,labels", "--limit", "50"
      );
      const issues: { title: string; url: string; labels: { name: string }[] }[] = JSON.parse(issuesJson);

      for (const issue of issues) {
        const titleLower = issue.title.toLowerCase();
        const onBoard = boardTitles.some(
          (bt) => bt.includes(titleLower.slice(0, 20)) || titleLower.includes(bt.slice(0, 20))
        );
        if (!onBoard) {
          untracked.push({
            repo: repo.name,
            title: issue.title,
            url: issue.url,
            labels: issue.labels.map((l) => l.name),
          });
        }
      }
    } catch {
      // Skip repos we can't access
    }
  }

  if (untracked.length > 0) {
    console.log(`  Also found ${untracked.length} untracked issues (not on board yet).\n`);
  }

  let assigned = 0;

  // Route unassigned board items
  for (const item of unassigned) {
    // Try to find which repo this item came from (by title match across repos)
    const repoHint = findRepoForItem(item.title, activeRepos, config.oracleRepos);
    const result = route(
      { title: item.title, repo: repoHint, labels: [] },
      routing
    );

    const oracleOpt = oracleField.options!.find(
      (o) => o.name.toLowerCase() === result.oracle.toLowerCase()
    );

    if (!oracleOpt) {
      console.log(`  ✗ "${item.title.slice(0, 40)}" → ${result.oracle} (not in field options, skipping)`);
      continue;
    }

    if (opts.dryRun) {
      console.log(`  → "${item.title.slice(0, 40)}" → ${result.oracle} (${result.reason}${result.matched ? `: ${result.matched}` : ""})`);
    } else {
      await gh(
        "project", "item-edit", "--project-id", projectId,
        "--id", item.id, "--field-id", oracleField.id,
        "--single-select-option-id", oracleOpt.id
      );
      console.log(`  ✓ "${item.title.slice(0, 40)}" → ${result.oracle} (${result.reason})`);
      assigned++;

      // Notify oracle via maw hey (optional)
      if (opts.notify) {
        try {
          const proc = Bun.spawn(["maw", "hey", result.oracle.toLowerCase(), `New task assigned: ${item.title}`], {
            stdout: "pipe",
            stderr: "pipe",
          });
          await proc.exited;
        } catch {
          // maw notification is best-effort
        }
      }
    }
  }

  console.log();
  if (opts.dryRun) {
    console.log(`  Dry run complete. ${unassigned.length} items would be assigned.`);
  } else {
    console.log(`  ${assigned} items assigned.`);
  }

  if (untracked.length > 0) {
    console.log(`  ${untracked.length} untracked issues need \`pulse add\` first.`);
    console.log();
    for (const u of untracked) {
      const result = route(
        { title: u.title, repo: u.repo, labels: u.labels },
        routing
      );
      console.log(`  ${u.repo.slice(0, 20).padEnd(20)}  "${u.title.slice(0, 35).padEnd(35)}"  → ${result.oracle} (${result.reason})`);
    }
  }

  console.log();
}

/** Best-effort repo detection for a board item (by reverse-looking oracleRepos mapping) */
function findRepoForItem(
  title: string,
  _activeRepos: { name: string }[],
  oracleRepos: Record<string, string>
): string {
  // If title mentions an oracle name or repo name, use it
  const titleLower = title.toLowerCase();
  for (const [oracle, repo] of Object.entries(oracleRepos)) {
    if (titleLower.includes(oracle) || titleLower.includes(repo.toLowerCase())) {
      return repo;
    }
  }
  return "";
}
