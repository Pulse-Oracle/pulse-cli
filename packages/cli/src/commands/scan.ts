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
  timestamp: number; // last fetch time (ms)
  activities: RepoActivity[];
}

const CACHE_DIR = join(process.env.HOME || "~", ".cache", "pulse");

function cacheFile(): string {
  const today = new Date().toISOString().slice(0, 10);
  return join(CACHE_DIR, `scan-mine-${today}.json`);
}

function readCache(): ScanCache | null {
  try {
    // Clear require cache so re-reads work within same process
    delete require.cache[cacheFile()];
    const raw = require(cacheFile());
    const cache = raw as ScanCache;
    const today = new Date().toISOString().slice(0, 10);
    if (cache.date !== today) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeCache(activities: RepoActivity[], timestamp?: number): void {
  const today = new Date().toISOString().slice(0, 10);
  const cache: ScanCache = { date: today, timestamp: timestamp || Date.now(), activities };
  try {
    Bun.spawnSync(["mkdir", "-p", CACHE_DIR]);
    Bun.write(cacheFile(), JSON.stringify(cache));
  } catch {
    // Cache write is best-effort
  }
}

/** Merge new activities into cached ones, deduplicating by sha */
function mergeActivities(cached: RepoActivity[], fresh: RepoActivity[]): RepoActivity[] {
  const merged = new Map<string, RepoActivity>();

  // Start with cached
  for (const act of cached) {
    merged.set(act.repo, { ...act, commits: [...act.commits] });
  }

  // Merge fresh commits in
  for (const act of fresh) {
    const existing = merged.get(act.repo);
    if (existing) {
      const seenShas = new Set(existing.commits.map(c => c.sha));
      for (const c of act.commits) {
        if (!seenShas.has(c.sha)) {
          existing.commits.unshift(c); // new commits go first
        }
      }
    } else {
      merged.set(act.repo, { ...act, commits: [...act.commits] });
    }
  }

  return [...merged.values()];
}

async function fetchActivities(
  allContexts: { ctx: { org: string; projectNumber: number }; label: string }[],
  repoToOracle: Map<string, string>,
  sinceISO: string,
  /** Only fetch repos updated after this timestamp (for incremental) */
  updatedAfter?: string
) {
  const activities: RepoActivity[] = [];
  let totalRepos = 0;
  let fetchedRepos = 0;
  const orgLabels: string[] = [];

  for (const { ctx, label } of allContexts) {
    let repos: { name: string; isArchived: boolean; pushedAt: string }[];
    try {
      const reposJson = await gh("repo", "list", ctx.org, "--json", "name,isArchived,pushedAt", "--limit", "100");
      repos = JSON.parse(reposJson);
    } catch {
      continue;
    }
    let activeRepos = repos.filter(r => !r.isArchived);
    totalRepos += activeRepos.length;

    // Skip repos not pushed since last cache
    if (updatedAfter) {
      activeRepos = activeRepos.filter(r => r.pushedAt > updatedAfter);
    }
    fetchedRepos += activeRepos.length;
    orgLabels.push(`${label} (${activeRepos.length}/${repos.filter(r => !r.isArchived).length})`);

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

  return { activities, totalRepos, fetchedRepos, orgLabels };
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

  // Incremental cache: read cached commits, fetch only delta since last cache
  const cached = noCache ? null : readCache();
  let activities: RepoActivity[];
  let fetchInfo: string;

  if (cached) {
    // Incremental: only check repos pushed since last cache
    const updatedAfter = new Date(cached.timestamp).toISOString();
    const delta = await fetchActivities(allContexts, repoToOracle, sinceISO, updatedAfter);
    const newCommits = delta.activities.reduce((sum, a) => sum + a.commits.length, 0);

    if (newCommits > 0) {
      activities = mergeActivities(cached.activities, delta.activities);
      writeCache(activities);
      fetchInfo = `+${newCommits} new (checked ${delta.fetchedRepos} updated repos)`;
    } else {
      activities = cached.activities;
      const age = Math.round((Date.now() - cached.timestamp) / 1000);
      fetchInfo = `${age}s ago, ${delta.fetchedRepos} repos checked, no new`;
    }
  } else {
    // Full fetch from midnight
    const result = await fetchActivities(allContexts, repoToOracle, sinceISO);
    activities = result.activities;
    writeCache(activities);
    fetchInfo = `${result.totalRepos} repos across ${result.orgLabels.join(" + ")}`;
  }

  let totalCommits = activities.reduce((sum, a) => sum + a.commits.length, 0);
  console.log(`\n  Pulse — Oracle Family Scan  (${fetchInfo}, today)\n`);

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
  console.log();
}
