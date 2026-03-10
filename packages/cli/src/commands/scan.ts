import { gh, getItems } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function scan() {
  const ctx = getContext();
  const reposJson = await gh("repo", "list", ctx.org, "--json", "name,url,isArchived,updatedAt", "--limit", "100");
  const repos: { name: string; url: string; isArchived: boolean; updatedAt: string }[] = JSON.parse(reposJson);
  const activeRepos = repos.filter(r => !r.isArchived);

  const items = await getItems(ctx);
  const boardTitles = items.map(i => i.title.toLowerCase());

  console.log(`\n  Pulse — Scan  (${activeRepos.length} active repos in ${ctx.org})\n`);

  const untracked: { repo: string; title: string; url: string }[] = [];

  for (const repo of activeRepos) {
    try {
      const issuesJson = await gh(
        "issue", "list", "--repo", `${ctx.org}/${repo.name}`,
        "--state", "open", "--json", "title,url", "--limit", "50"
      );
      const issues: { title: string; url: string }[] = JSON.parse(issuesJson);

      for (const issue of issues) {
        const titleLower = issue.title.toLowerCase();
        const onBoard = boardTitles.some(bt =>
          bt.includes(titleLower.slice(0, 20)) || titleLower.includes(bt.slice(0, 20))
        );
        if (!onBoard) {
          untracked.push({ repo: repo.name, title: issue.title, url: issue.url });
        }
      }
    } catch {
      // Skip repos we can't access
    }
  }

  if (untracked.length === 0) {
    console.log("  All open issues are tracked on the Master Board.");
  } else {
    console.log(`  Found ${untracked.length} untracked open issues:\n`);
    console.log("  Repo                    Title                                        URL");
    console.log("  " + "─".repeat(100));
    for (const u of untracked) {
      console.log(`  ${u.repo.slice(0, 22).padEnd(22)}  ${u.title.slice(0, 42).padEnd(42)}  ${u.url}`);
    }
  }
  console.log();
}
