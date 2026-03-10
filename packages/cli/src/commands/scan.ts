import { join } from "path";
import { gh, getItems } from "@pulse-oracle/sdk";
import { getContext, loadConfig, getAllContexts } from "../config";

export async function scan(opts: { mine?: boolean; noCache?: boolean } = {}) {
  if (opts.mine) {
    await scanMine(opts.noCache);
    return;
  }

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

// ─── scan --mine ─────────────────────────────────────

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

interface RepoActivity {
  repo: string;
  oracle: string;
  commits: Commit[];
}

interface ScanCache {
  date: string; // YYYY-MM-DD
  timestamp: number;
  activities: RepoActivity[];
}

const CACHE_DIR = join(process.env.HOME || "~", ".cache", "pulse");
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheFile(): string {
  const today = new Date().toISOString().slice(0, 10);
  return join(CACHE_DIR, `scan-mine-${today}.json`);
}

function readCache(): ScanCache | null {
  try {
    const raw = require(cacheFile());
    const cache = raw as ScanCache;
    const today = new Date().toISOString().slice(0, 10);
    if (cache.date !== today) return null;
    if (Date.now() - cache.timestamp > CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeCache(activities: RepoActivity[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const cache: ScanCache = { date: today, timestamp: Date.now(), activities };
  try {
    Bun.spawnSync(["mkdir", "-p", CACHE_DIR]);
    Bun.write(cacheFile(), JSON.stringify(cache));
  } catch {
    // Cache write is best-effort
  }
}

async function fetchActivities(allContexts: { ctx: { org: string; projectNumber: number }; label: string }[], repoToOracle: Map<string, string>, sinceISO: string) {
  const activities: RepoActivity[] = [];
  let totalRepos = 0;
  const orgLabels: string[] = [];

  for (const { ctx, label } of allContexts) {
    let repos: { name: string; isArchived: boolean }[];
    try {
      const reposJson = await gh("repo", "list", ctx.org, "--json", "name,isArchived", "--limit", "100");
      repos = JSON.parse(reposJson);
    } catch {
      continue;
    }
    const activeRepos = repos.filter(r => !r.isArchived);
    totalRepos += activeRepos.length;
    orgLabels.push(`${label} (${activeRepos.length})`);

    // Fetch commits in parallel (batches of 10)
    const batch = 10;
    for (let i = 0; i < activeRepos.length; i += batch) {
      const chunk = activeRepos.slice(i, i + batch);
      const results = await Promise.allSettled(
        chunk.map(async (repo) => {
          const commitsJson = await gh(
            "api", `repos/${ctx.org}/${repo.name}/commits?since=${sinceISO}&per_page=50`,
            "--jq", `[.[] | {sha: .sha[0:7], message: (.commit.message | split("\n")[0]), author: (.commit.author.name // .author.login // "unknown"), date: .commit.author.date}]`
          );
          if (!commitsJson.trim() || commitsJson.trim() === "[]") return null;
          const commits: Commit[] = JSON.parse(commitsJson);
          if (commits.length === 0) return null;
          const oracle = repoToOracle.get(repo.name.toLowerCase()) || "-";
          return { repo: `${ctx.org}/${repo.name}`, oracle, commits } as RepoActivity;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          activities.push(r.value);
        }
      }
    }
  }

  return { activities, totalRepos, orgLabels };
}

async function scanMine(noCache?: boolean) {
  const config = loadConfig();
  const allContexts = getAllContexts();
  const today = new Date();
  const since = new Date(today);
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  // Build reverse map: repo name → oracle name
  const repoToOracle = new Map<string, string>();
  for (const [oracle, repo] of Object.entries(config.oracleRepos)) {
    repoToOracle.set(repo.toLowerCase(), oracle);
  }

  // Try cache first
  const cached = noCache ? null : readCache();
  let activities: RepoActivity[];
  let totalRepos: number;
  let orgLabels: string[];
  let fromCache = false;

  if (cached) {
    activities = cached.activities;
    totalRepos = 0; // Not stored in cache
    orgLabels = [];
    fromCache = true;
  } else {
    const result = await fetchActivities(allContexts, repoToOracle, sinceISO);
    activities = result.activities;
    totalRepos = result.totalRepos;
    orgLabels = result.orgLabels;
    writeCache(activities);
  }

  let totalCommits = activities.reduce((sum, a) => sum + a.commits.length, 0);

  const header = fromCache
    ? `Pulse — Oracle Family Scan  (cached, today)`
    : `Pulse — Oracle Family Scan  (${totalRepos} repos across ${orgLabels.join(" + ")}, today)`;
  console.log(`\n  ${header}\n`);

  if (activities.length === 0) {
    console.log("  No commits found today across the oracle family.\n");
    return;
  }

  // Sort by commit count descending
  activities.sort((a, b) => b.commits.length - a.commits.length);

  // Print grouped by repo
  for (const act of activities) {
    const label = act.oracle !== "-" ? `${act.oracle}` : "";
    const repoShort = act.repo.split("/").pop()!;
    console.log(`  ${repoShort.padEnd(25)} ${label.padEnd(12)} ${act.commits.length} commit${act.commits.length > 1 ? "s" : ""}`);
    for (const c of act.commits) {
      const authorTag = c.author.includes("Claude") || c.author.includes("claude") ? " 🤖" : "";
      console.log(`    ${c.sha}  ${c.message.slice(0, 65)}${authorTag}`);
    }
    console.log();
  }

  // Summary
  const oracleSet = new Set(activities.filter(a => a.oracle !== "-").map(a => a.oracle));
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  ${totalCommits} commits across ${activities.length} repos (${allContexts.length} org${allContexts.length > 1 ? "s" : ""})`);
  if (oracleSet.size > 0) {
    console.log(`  Active oracles: ${[...oracleSet].join(", ")}`);
  }
  if (fromCache) {
    const age = Math.round((Date.now() - cached!.timestamp) / 1000);
    console.log(`  (cached ${age}s ago — run with --no-cache to refresh)`);
  }
  console.log();
}
