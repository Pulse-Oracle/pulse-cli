import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { getRepoToOracle, getOrgDir } from "./config";

// ─── Oracle → Repo mapping (from config) ─────────────────

function getOracleMap(): Record<string, string> {
  return getRepoToOracle();
}

export function resolveOracle(dirName: string): string {
  const base = dirName.replace(/\.wt-\d+.*$/, "").toLowerCase();
  const map = getOracleMap();
  return map[base] || base;
}

// ─── Worktree scanner ─────────────────────

export interface Worktree {
  name: string;
  oracle: string;
  branch: string;
  dirty: number;
  lastCommit: string;
  lastCommitMsg: string;
  lastCommitDate: Date;
  isMain: boolean;
}

export function scanWorktrees(): Worktree[] {
  const codeDir = getOrgDir();
  if (!existsSync(codeDir)) return [];

  const worktrees: Worktree[] = [];
  let entries: string[];
  try { entries = readdirSync(codeDir); } catch { return []; }

  for (const entry of entries) {
    const fullPath = join(codeDir, entry);
    const isWt = entry.includes(".wt-");
    const map = getOracleMap();
    const isKnownMain = map[entry.toLowerCase()] !== undefined;

    if (!isWt && !isKnownMain) continue;

    try {
      const branch = Bun.spawnSync(
        ["git", "-C", fullPath, "branch", "--show-current"],
        { stdout: "pipe", stderr: "pipe" }
      );
      const branchName = new TextDecoder().decode(branch.stdout).trim();
      if (!branchName) continue;

      const dirty = Bun.spawnSync(
        ["git", "-C", fullPath, "status", "--porcelain"],
        { stdout: "pipe", stderr: "pipe" }
      );
      const dirtyLines = new TextDecoder().decode(dirty.stdout).trim();
      const dirtyCount = dirtyLines ? dirtyLines.split("\n").length : 0;

      const log = Bun.spawnSync(
        ["git", "-C", fullPath, "log", "-1", "--format=%ar\t%s\t%aI"],
        { stdout: "pipe", stderr: "pipe" }
      );
      const logOut = new TextDecoder().decode(log.stdout).trim();
      const [age, msg, isoDate] = logOut.split("\t");

      worktrees.push({
        name: entry,
        oracle: resolveOracle(entry),
        branch: branchName,
        dirty: dirtyCount,
        lastCommit: age || "unknown",
        lastCommitMsg: msg || "",
        lastCommitDate: isoDate ? new Date(isoDate) : new Date(0),
        isMain: !isWt,
      });
    } catch { continue; }
  }

  return worktrees.sort((a, b) => b.lastCommitDate.getTime() - a.lastCommitDate.getTime());
}

export function extractSlug(wtName: string): string {
  return wtName.replace(/^.*\.wt-\d+-?/, "");
}
