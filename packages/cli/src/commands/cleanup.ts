import { getItems } from "@pulse-oracle/sdk";
import { getContext, getOrgDir } from "../config";
import { scanWorktrees, extractSlug, type Worktree } from "../worktree";
import { mawPeek } from "../maw";

const STALE_DAYS = 7;

interface CleanupCandidate {
  worktree: Worktree;
  slug: string;
  reason: string;
  boardMatch: string | null;
  boardStatus: string | null;
}

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatAge(date: Date): string {
  const d = daysAgo(date);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

export async function cleanup() {
  const worktrees = scanWorktrees().filter(w => !w.isMain);

  if (worktrees.length === 0) {
    console.log("  No worktrees found.");
    return;
  }

  const items = await getItems(getContext());

  const candidates: CleanupCandidate[] = [];
  const active: Worktree[] = [];

  for (const wt of worktrees) {
    const slug = extractSlug(wt.name);
    const age = daysAgo(wt.lastCommitDate);

    const match = items.find(item => {
      if (!item.oracle) return false;
      if (item.oracle.toLowerCase() !== wt.oracle.toLowerCase()) return false;
      if (item.worktree && slug && item.worktree.toLowerCase() === slug.toLowerCase()) return true;
      if (slug && item.title.toLowerCase().includes(slug.toLowerCase())) return true;
      return false;
    });

    const boardStatus = match?.status || null;

    if (boardStatus === "Done") {
      candidates.push({ worktree: wt, slug, reason: "Board item Done", boardMatch: match!.title, boardStatus });
    } else if (!match && age >= 1) {
      candidates.push({ worktree: wt, slug, reason: "No board match (orphan)", boardMatch: null, boardStatus: null });
    } else if (age >= STALE_DAYS && wt.dirty === 0) {
      candidates.push({ worktree: wt, slug, reason: `No commits in ${age}d, clean`, boardMatch: match?.title || null, boardStatus });
    } else if (age >= STALE_DAYS * 2) {
      candidates.push({ worktree: wt, slug, reason: `No commits in ${age}d`, boardMatch: match?.title || null, boardStatus });
    } else {
      active.push(wt);
    }
  }

  if (active.length > 0) {
    console.log(`\n  Active Worktrees (${active.length})\n`);
    const hdr = "  " + "Name".padEnd(50) + "Oracle".padEnd(12) + "Branch".padEnd(30) + "Last Commit".padEnd(16) + "Dirty";
    console.log(hdr);
    console.log("  " + "\u2500".repeat(hdr.length - 2));
    for (const wt of active) {
      const name = wt.name.length > 48 ? wt.name.slice(0, 45) + "..." : wt.name;
      console.log(
        `  ${name.padEnd(50)}${wt.oracle.padEnd(12)}${wt.branch.padEnd(30)}${formatAge(wt.lastCommitDate).padEnd(16)}${wt.dirty || ""}`
      );
    }
  }

  if (candidates.length === 0) {
    console.log("\n  No stale worktrees found.\n");
    return;
  }

  console.log(`\n  Stale Worktrees (${candidates.length})\n`);
  const hdr2 = "  " + "Name".padEnd(50) + "Oracle".padEnd(12) + "Last Commit".padEnd(16) + "Dirty".padEnd(8) + "Reason";
  console.log(hdr2);
  console.log("  " + "\u2500".repeat(hdr2.length - 2));

  for (const c of candidates) {
    const name = c.worktree.name.length > 48 ? c.worktree.name.slice(0, 45) + "..." : c.worktree.name;
    const dirty = c.worktree.dirty ? `${c.worktree.dirty}` : "";
    console.log(
      `  ${name.padEnd(50)}${c.worktree.oracle.padEnd(12)}${formatAge(c.worktree.lastCommitDate).padEnd(16)}${dirty.padEnd(8)}${c.reason}`
    );
    if (c.boardMatch) {
      console.log(`  ${"".padEnd(50)}${"".padEnd(12)}Board: ${c.boardMatch} [${c.boardStatus}]`);
    }
  }

  // Check for active tmux sessions before suggesting removal
  const safe: CleanupCandidate[] = [];
  for (const c of candidates) {
    if (c.worktree.dirty > 0) {
      console.log(`  SKIP: ${c.worktree.name} (${c.worktree.dirty} dirty files)`);
      continue;
    }
    // Check if agent is alive in tmux
    const wtMatch = c.worktree.name.match(/\.wt-(\d+)-?(.*)$/);
    if (wtMatch) {
      const oracleLower = c.worktree.oracle.toLowerCase();
      const windowName = `${oracleLower}-${wtMatch[1]}-${wtMatch[2]}`.replace(/-$/, "");
      const peek = await mawPeek(windowName);
      if (peek.alive) {
        console.log(`  SKIP: ${c.worktree.name} (tmux session "${windowName}" is ALIVE)`);
        continue;
      }
    }
    safe.push(c);
  }

  if (safe.length === 0) {
    console.log("\n  Nothing safe to remove.\n");
    return;
  }

  console.log(`\n  ACTION REQUIRED: ${safe.length} worktree(s) can be removed:\n`);
  for (const c of safe) {
    console.log(`    maw done ${c.worktree.name.replace(/^.*\.wt-(\d+)-?(.*)$/, (_, n, s) => `${c.worktree.oracle.toLowerCase()}-${n}-${s}`).replace(/-$/, "")}`);
  }
  console.log();
}
