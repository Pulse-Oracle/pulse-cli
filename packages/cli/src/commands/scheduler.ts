import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { getItems, postComment } from "@pulse-oracle/sdk";
import type { SchedulerOpts } from "@pulse-oracle/sdk";
import { getContext, getOrgDir, getRepoName } from "../config";
import { scanWorktrees } from "../worktree";

const DISCUSSION_NUMBER = 50;

// ─── Today's commits across all repos ─────

async function todayCommits(): Promise<{ repo: string; hash: string; msg: string; age: string }[]> {
  const codeDir = getOrgDir();
  if (!existsSync(codeDir)) return [];

  const commits: { repo: string; hash: string; msg: string; age: string }[] = [];
  let repos: string[];
  try { repos = readdirSync(codeDir); } catch { return []; }

  for (const repo of repos) {
    const repoPath = join(codeDir, repo);
    try {
      const result = Bun.spawnSync(
        ["git", "-C", repoPath, "log", "--oneline", "--since=midnight", "--format=%h\t%s\t%ar"],
        { stdout: "pipe", stderr: "pipe" }
      );
      const out = new TextDecoder().decode(result.stdout).trim();
      if (!out) continue;
      for (const line of out.split("\n")) {
        const [hash, msg, age] = line.split("\t");
        if (hash && msg) commits.push({ repo, hash, msg, age: age || "" });
      }
    } catch { /* skip */ }
  }
  return commits;
}

async function postToDiscussion(body: string) {
  const ctx = getContext();
  await postComment(ctx.org, getRepoName(), DISCUSSION_NUMBER, body);
}

// ─── Morning Standup ─────────────────────────

export async function standup(opts: SchedulerOpts = {}): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

  const items = await getItems(getContext());
  const active = items.filter(i => i.status && i.status !== "Done" && i.status !== "Archived");
  const p0 = active.filter(i => i.priority === "P0");
  const p1 = active.filter(i => i.priority === "P1");
  const inProgress = active.filter(i => i.status === "In Progress");

  const today = now.toISOString().slice(0, 10);
  const overdue = active.filter(i => i["target date"] && i["target date"] < today);
  const unassigned = active.filter(i => !i.oracle);

  const worktrees = scanWorktrees();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const idleWt = worktrees.filter(w => w.lastCommitDate < threeDaysAgo);
  const activeWt = worktrees.filter(w => w.lastCommitDate >= threeDaysAgo);

  let report = `## Morning Standup — ${dateStr}\n\n`;

  report += `### Board Overview\n\n`;
  report += `- Active items: **${active.length}**\n`;
  report += `- P0: **${p0.length}**${p0.length > 0 ? " — " + p0.map(i => i.title.slice(0, 40)).join(", ") : ""}\n`;
  report += `- P1: **${p1.length}**${p1.length > 0 ? " — " + p1.map(i => i.title.slice(0, 40)).join(", ") : ""}\n`;
  report += `- In Progress: **${inProgress.length}**\n`;
  if (overdue.length > 0) {
    report += `- Overdue: **${overdue.length}** — ${overdue.map(i => `${i.title.slice(0, 30)} (${i["target date"]})`).join(", ")}\n`;
  }
  if (unassigned.length > 0) {
    report += `- Unassigned: **${unassigned.length}** — ${unassigned.map(i => i.title.slice(0, 30)).join(", ")}\n`;
  }
  report += "\n";

  if (activeWt.length > 0) {
    report += `### Active Worktrees (${activeWt.length})\n\n`;
    report += `| Oracle | Worktree | Branch | Dirty | Last Commit |\n|--------|----------|--------|-------|-------------|\n`;
    for (const w of activeWt) {
      report += `| ${w.oracle} | ${w.name} | ${w.branch} | ${w.dirty} | ${w.lastCommit}: ${w.lastCommitMsg.slice(0, 40)} |\n`;
    }
    report += "\n";
  }

  if (idleWt.length > 0) {
    report += `### Idle Worktrees (${idleWt.length}, 3+ days)\n\n`;
    report += `| Worktree | Oracle | Dirty | Last Commit |\n|----------|--------|-------|-------------|\n`;
    for (const w of idleWt) {
      const warn = w.dirty > 0 ? " **!**" : "";
      report += `| ${w.name}${warn} | ${w.oracle} | ${w.dirty} | ${w.lastCommit} |\n`;
    }
    report += "\n";
    const dirtyIdle = idleWt.filter(w => w.dirty > 0);
    if (dirtyIdle.length > 0) {
      report += `> **${dirtyIdle.length}** idle worktree(s) have uncommitted changes\n\n`;
    }
  }

  report += `\n---\n— Oracle (Pulse) [daily-standup]`;

  console.log(report);
  if (opts.post) {
    await postToDiscussion(report);
    console.log(`\n  Posted standup to Discussion #${DISCUSSION_NUMBER}`);
  }
  return report;
}

// ─── Evening Wrapup ──────────────────────────

export async function wrapup(opts: SchedulerOpts = {}): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

  const items = await getItems(getContext());
  const active = items.filter(i => i.status && i.status !== "Done" && i.status !== "Archived");
  const inProgress = active.filter(i => i.status === "In Progress");

  const commits = await todayCommits();
  const commitsByRepo = new Map<string, number>();
  for (const c of commits) {
    commitsByRepo.set(c.repo, (commitsByRepo.get(c.repo) || 0) + 1);
  }

  const worktrees = scanWorktrees();
  const dirtyWt = worktrees.filter(w => w.dirty > 0);

  let report = `## Evening Wrapup — ${dateStr}\n\n`;

  report += `### Today's Activity\n\n`;
  report += `- Commits: **${commits.length}** across **${commitsByRepo.size}** repos\n`;
  report += `- Active worktrees: **${worktrees.length}**\n`;
  report += `- Dirty worktrees: **${dirtyWt.length}**${dirtyWt.length > 0 ? " — uncommitted work at risk" : ""}\n\n`;

  if (commits.length > 0) {
    report += `### Commits Today\n\n`;
    report += `| Repo | Commit |\n|------|--------|\n`;
    for (const c of commits.slice(0, 20)) {
      report += `| ${c.repo} | \`${c.hash}\` ${c.msg} |\n`;
    }
    if (commits.length > 20) report += `| ... | +${commits.length - 20} more |\n`;
    report += "\n";
  }

  if (dirtyWt.length > 0) {
    report += `### Uncommitted Work\n\n`;
    report += `| Worktree | Oracle | Dirty | Branch |\n|----------|--------|-------|--------|\n`;
    for (const w of dirtyWt) {
      report += `| ${w.name} | ${w.oracle} | ${w.dirty} | ${w.branch} |\n`;
    }
    report += "\n";
  }

  if (inProgress.length > 0) {
    report += `### Still In Progress (${inProgress.length})\n\n`;
    report += `| Title | Oracle | Priority |\n|-------|--------|----------|\n`;
    for (const item of inProgress) {
      report += `| ${item.title.slice(0, 50)} | ${item.oracle || "-"} | ${item.priority || "-"} |\n`;
    }
    report += "\n";
  }

  report += `\n---\n— Oracle (Pulse) [daily-wrapup]`;

  console.log(report);
  if (opts.post) {
    await postToDiscussion(report);
    console.log(`\n  Posted wrapup to Discussion #${DISCUSSION_NUMBER}`);
  }
  return report;
}

// ─── Idle Detection ──────────────────────────

export async function idle(opts: SchedulerOpts = {}): Promise<string> {
  const days = opts.days || 3;
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const worktrees = scanWorktrees();
  const staleWt = worktrees.filter(w => w.lastCommitDate < cutoff);
  const dirtyStale = staleWt.filter(w => w.dirty > 0);

  let report = `## Idle Detection — ${days}+ days\n\n`;

  if (staleWt.length > 0) {
    report += `### Stale Worktrees (${staleWt.length})\n\n`;
    report += `| Worktree | Oracle | Branch | Dirty | Last Commit |\n|----------|--------|--------|-------|-------------|\n`;
    for (const w of staleWt) {
      const warn = w.dirty > 0 ? " **!**" : "";
      report += `| ${w.name}${warn} | ${w.oracle} | ${w.branch} | ${w.dirty} | ${w.lastCommit} |\n`;
    }
    report += "\n";

    if (dirtyStale.length > 0) {
      report += `> **${dirtyStale.length}** stale worktree(s) have uncommitted changes\n\n`;
    }
  } else {
    report += `All worktrees active within ${days} days.\n\n`;
  }

  report += `\n---\n— Oracle (Pulse) [idle-detection]`;

  console.log(report);
  if (opts.post) {
    await postToDiscussion(report);
    console.log(`\n  Posted idle report to Discussion #${DISCUSSION_NUMBER}`);
  }
  return report;
}

// ─── Main entry ──────────────────────────────

export async function scheduler(mode: string, opts: SchedulerOpts = {}) {
  switch (mode) {
    case "standup": return standup(opts);
    case "wrapup": return wrapup(opts);
    case "idle": return idle(opts);
    default:
      console.log(`
  pulse scheduler — Daily automation

  Subcommands:
    standup     Morning standup (board overview, overdue, active/idle worktrees)
    wrapup      Evening wrapup (today's commits, dirty worktrees, in-progress items)
    idle        Detect stale worktrees (default: 3+ days)

  Options:
    --post      Post to Discussion #50
    --days N    Override idle threshold (default: 3)

  Examples:
    pulse scheduler standup
    pulse scheduler wrapup --post
    pulse scheduler idle --days 7
`);
  }
}
