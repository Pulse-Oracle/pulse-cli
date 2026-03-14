import { join, basename } from "path";
import { homedir } from "os";
import { readdirSync, existsSync, readFileSync } from "fs";
import { getItems, postComment, updateDiscussion } from "@pulse-oracle/sdk";
import { getContext, getOrgDir, getRepoName, loadConfig } from "../config";

const DISCUSSION_NUMBER = 50;

// ─── Session digger ─────────────────────────────

interface Session {
  start: string;
  end: string;
  durationMin: number;
  repo: string;
  messages: number;
  summary: string;
}

function digSessions(limit: number): Session[] {
  const home = homedir();
  const projectsDir = join(home, ".claude", "projects");
  if (!existsSync(projectsDir)) return [];

  const sessions: Session[] = [];

  try {
    const dirs = readdirSync(projectsDir).filter(d => {
      const full = join(projectsDir, d);
      try { return readdirSync(full).length > 0; } catch { return false; }
    });

    for (const dir of dirs) {
      const dirPath = join(projectsDir, dir);
      let entries: string[];
      try { entries = readdirSync(dirPath); } catch { continue; }

      const jsonlFiles = entries
        .filter(e => e.endsWith(".jsonl"))
        .map(e => {
          const fp = join(dirPath, e);
          try {
            const stat = require("fs").statSync(fp);
            return { name: e, path: fp, mtime: stat.mtimeMs };
          } catch { return null; }
        })
        .filter(Boolean) as { name: string; path: string; mtime: number }[];

      jsonlFiles.sort((a, b) => b.mtime - a.mtime);

      const afterOrg = dir.match(/github-com-[\w]+-[\w]+-(.+)/);
      let repoName = afterOrg ? afterOrg[1] : dir;
      const wtMatch = repoName.match(/-wt-\d+-(.+)$/);
      if (wtMatch) {
        repoName = repoName.replace(/-wt-\d+.*$/, "") + ` (${wtMatch[1]})`;
      } else {
        const wtNumMatch = repoName.match(/-wt-(\d+)$/);
        if (wtNumMatch) {
          repoName = repoName.replace(/-wt-\d+$/, "") + ` (wt-${wtNumMatch[1]})`;
        }
      }

      for (const file of jsonlFiles.slice(0, limit)) {
        try {
          const content = readFileSync(file.path, "utf-8");
          const lines = content.split("\n").filter((l: string) => l.trim());
          if (lines.length === 0) continue;

          const sample = lines.length <= 40
            ? lines
            : [...lines.slice(0, 20), ...lines.slice(-20)];

          let firstTs = "", lastTs = "", humanMsgs = 0, firstHuman = "";
          for (const line of sample) {
            try {
              const obj = JSON.parse(line);
              const ts = obj.timestamp || "";
              if (!firstTs && ts) firstTs = ts;
              if (ts) lastTs = ts;
              if (obj.type === "user" && obj.userType === "external") {
                humanMsgs++;
                if (!firstHuman) {
                  const raw = obj.data?.message || obj.message || "";
                  let msg = "";
                  if (typeof raw === "string") {
                    msg = raw;
                  } else if (typeof raw === "object") {
                    const content = raw.content;
                    if (typeof content === "string") {
                      msg = content;
                    } else if (Array.isArray(content)) {
                      const textBlock = content.find((b: any) => b.type === "text");
                      msg = textBlock?.text || "";
                    }
                  }
                  msg = msg.replace(/<[^>]+>/g, "").trim();
                  firstHuman = msg.slice(0, 80);
                }
              }
            } catch { /* skip bad lines */ }
          }

          if (!firstTs || humanMsgs === 0) continue;

          const startDate = new Date(firstTs);
          const endDate = new Date(lastTs);
          const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

          sessions.push({
            start: firstTs,
            end: lastTs,
            durationMin: Math.max(durationMin, 1),
            repo: repoName,
            messages: humanMsgs,
            summary: firstHuman,
          });
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* projects dir issue */ }

  sessions.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const seen = new Set<string>();
  const deduped = sessions.filter(s => {
    const key = `${s.start}|${s.repo}|${s.durationMin}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.slice(0, limit);
}

// ─── Git activity across repos ─────────

async function recentCommits(since?: string): Promise<{ repo: string; hash: string; msg: string; age: string }[]> {
  const codeDir = getOrgDir();
  if (!existsSync(codeDir)) return [];

  const commits: { repo: string; hash: string; msg: string; age: string }[] = [];
  let repos: string[];
  try { repos = readdirSync(codeDir); } catch { return []; }

  for (const repo of repos) {
    const repoPath = join(codeDir, repo);
    try {
      const sinceArg = since ? `--since=${since}` : "--since=1 hour ago";
      const result = Bun.spawnSync(
        ["git", "-C", repoPath, "log", "--oneline", sinceArg, "--format=%h\t%s\t%ar"],
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

// ─── Quick pulse (15m) ─────────────────────────

export async function monitorQuick() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

  const items = await getItems(getContext());
  const active = items.filter(i => i.status && i.status !== "Done" && i.status !== "Archived");
  const byOracle = new Map<string, number>();
  for (const item of active) {
    const oracle = item.oracle || "Unassigned";
    byOracle.set(oracle, (byOracle.get(oracle) || 0) + 1);
  }

  const sessions = digSessions(5);
  const recentRepos = [...new Set(sessions.map(s => s.repo))];

  const commits = await recentCommits("30 minutes ago");

  let report = `## Pulse — ${timeStr} ICT\n\n`;

  report += `| Metric | Value |\n|--------|-------|\n`;
  report += `| Board items (active) | ${active.length} |\n`;
  report += `| Projects in flight | ${recentRepos.length} |\n`;
  report += `| Recent commits (30m) | ${commits.length} |\n\n`;

  if (sessions.length > 0) {
    report += `### Recent Sessions\n\n`;
    report += `| Time | Repo | Min | Msgs |\n|------|------|-----|------|\n`;
    for (const s of sessions.slice(0, 5)) {
      const t = new Date(s.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
      report += `| ${t} | ${s.repo} | ${s.durationMin}m | ${s.messages} |\n`;
    }
    report += "\n";
  }

  if (commits.length > 0) {
    report += `### Recent Commits\n\n`;
    report += `| Repo | Commit |\n|------|--------|\n`;
    for (const c of commits.slice(0, 5)) {
      report += `| ${c.repo} | \`${c.hash}\` ${c.msg} |\n`;
    }
    report += "\n";
  }

  if (byOracle.size > 0) {
    report += `### Board by Oracle\n\n`;
    for (const [oracle, count] of [...byOracle.entries()].sort((a, b) => b[1] - a[1])) {
      report += `- **${oracle}**: ${count} items\n`;
    }
    report += "\n";
  }

  report += `\n— Oracle (Pulse) [auto-15m]`;

  console.log(report);
  return report;
}

// ─── Deep analysis (1h) ──────────────────────

export async function monitorDeep() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

  const items = await getItems(getContext());
  const active = items.filter(i => i.status && i.status !== "Done" && i.status !== "Archived");
  const p0 = active.filter(i => i.priority === "P0");
  const p1 = active.filter(i => i.priority === "P1");

  const sessions = digSessions(20);
  const recentRepos = [...new Set(sessions.map(s => s.repo))];
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages, 0);

  let overlaps = 0;
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const aStart = new Date(sessions[i].start).getTime();
      const aEnd = new Date(sessions[i].end).getTime();
      const bStart = new Date(sessions[j].start).getTime();
      const bEnd = new Date(sessions[j].end).getTime();
      if (aStart < bEnd && bStart < aEnd) overlaps++;
    }
  }

  const commits = await recentCommits("1 hour ago");

  let report = `## Hourly Report — ${timeStr} ICT\n\n`;

  report += `### Active Sessions (recent ${sessions.length})\n\n`;
  if (sessions.length > 0) {
    report += `| Time | Repo | Duration | Msgs | Focus |\n|------|------|----------|------|-------|\n`;
    for (const s of sessions.slice(0, 10)) {
      const t = new Date(s.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
      report += `| ${t} | ${s.repo} | ${s.durationMin}m | ${s.messages} | ${s.summary.slice(0, 40)} |\n`;
    }
    report += "\n";
  }

  report += `### Projects in Flight\n\n`;
  report += `**${recentRepos.length}** unique repos: ${recentRepos.join(", ")}\n\n`;

  report += `### Multi-tasking Score\n\n`;
  report += `- Overlapping sessions: **${overlaps}**\n`;
  report += `- Total time: **${totalMinutes}m** across **${sessions.length}** sessions\n`;
  report += `- Total messages: **${totalMessages}**\n\n`;

  report += `### Board Status\n\n`;
  report += `- Active items: **${active.length}**\n`;
  report += `- P0: **${p0.length}**${p0.length > 0 ? " — " + p0.map(i => i.title.slice(0, 30)).join(", ") : ""}\n`;
  report += `- P1: **${p1.length}**${p1.length > 0 ? " — " + p1.map(i => i.title.slice(0, 30)).join(", ") : ""}\n\n`;

  if (commits.length > 0) {
    report += `### Git Activity (last hour)\n\n`;
    report += `| Repo | Commit |\n|------|--------|\n`;
    for (const c of commits) {
      report += `| ${c.repo} | \`${c.hash}\` ${c.msg} |\n`;
    }
    report += "\n";
  }

  report += `### Patterns\n\n`;
  if (sessions.length > 0) {
    const avgDuration = Math.round(totalMinutes / sessions.length);
    report += `- Avg session: **${avgDuration}m**\n`;
    if (overlaps > 2) report += `- High context-switching detected\n`;
    if (recentRepos.length > 3) report += `- Working across many repos — consider focusing\n`;
    if (avgDuration < 10) report += `- Short sessions — lots of quick checks\n`;
    if (avgDuration > 60) report += `- Deep work sessions — good focus\n`;
  }

  report += `\n— Oracle (Pulse) [hourly-analysis]`;

  console.log(report);
  return report;
}

// ─── Main entry ─────────────────────────────

async function updateSentryDiscussion(body: string) {
  const ctx = getContext();
  await updateDiscussion(ctx.org, getRepoName(), DISCUSSION_NUMBER, body);
}

export async function sentry(mode: string, opts: { post?: boolean } = {}) {
  const shouldPost = opts.post ?? false;
  let report: string;

  if (mode === "deep") {
    report = await monitorDeep();
  } else {
    report = await monitorQuick();
  }

  if (shouldPost) {
    await updateSentryDiscussion(report);
    console.log(`\n  Updated Discussion #${DISCUSSION_NUMBER} (in-place)`);
  }
}
