import { describe, expect, test } from "bun:test";
import { daysAgo, type CleanupCandidate } from "../src/commands/cleanup";
import type { Worktree } from "../src/worktree";

// ─── Unit tests for pure functions ───────────────────────

describe("daysAgo", () => {
  const now = new Date("2026-03-14T12:00:00Z").getTime();

  test("returns 0 for today", () => {
    expect(daysAgo(new Date("2026-03-14T06:00:00Z"), now)).toBe(0);
  });

  test("returns 1 for yesterday", () => {
    expect(daysAgo(new Date("2026-03-13T06:00:00Z"), now)).toBe(1);
  });

  test("returns 7 for a week ago", () => {
    expect(daysAgo(new Date("2026-03-07T12:00:00Z"), now)).toBe(7);
  });

  test("floors partial days", () => {
    // 1.5 days ago → should be 1
    expect(daysAgo(new Date("2026-03-13T00:00:00Z"), now)).toBe(1);
  });
});

// ─── Classification logic tests ──────────────────────────

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    name: "test-repo.wt-1-feature",
    oracle: "Neo",
    branch: "agents/1-feature",
    dirty: 0,
    lastCommit: "1 day ago",
    lastCommitMsg: "fix: something",
    lastCommitDate: new Date("2026-03-13T12:00:00Z"),
    isMain: false,
    ...overrides,
  };
}

describe("classification logic", () => {
  // Replicate the classification from cleanup() as a pure function for testing
  const STALE_DAYS = 7;
  const ORPHAN_DAYS = 3;

  type BoardItem = { oracle: string; worktree?: string; title: string; status: string };

  function classify(wt: Worktree, items: BoardItem[], now: number = Date.now()): "active" | { reason: string } {
    const slug = wt.name.replace(/^.*\.wt-\d+-?/, "");
    const age = daysAgo(wt.lastCommitDate, now);

    const match = items.find(item => {
      if (item.oracle.toLowerCase() !== wt.oracle.toLowerCase()) return false;
      if (item.worktree && slug && item.worktree.toLowerCase() === slug.toLowerCase()) return true;
      if (slug && item.title.toLowerCase().includes(slug.toLowerCase())) return true;
      return false;
    });

    const boardStatus = match?.status || null;

    if (boardStatus === "Done") return { reason: "Board item Done" };
    if (!match && age >= ORPHAN_DAYS) return { reason: "No board match (orphan)" };
    if (age >= STALE_DAYS && wt.dirty === 0) return { reason: `No commits in ${age}d, clean` };
    if (age >= STALE_DAYS * 2) return { reason: `No commits in ${age}d` };
    return "active";
  }

  const now = new Date("2026-03-14T12:00:00Z").getTime();

  test("worktree with Done board item → candidate", () => {
    const wt = makeWorktree({ name: "maw-js.wt-1-bugfix" });
    const items: BoardItem[] = [{ oracle: "Neo", worktree: "bugfix", title: "Fix bugfix", status: "Done" }];
    const result = classify(wt, items, now);
    expect(result).toEqual({ reason: "Board item Done" });
  });

  test("orphan NOT flagged at age 1 day (was the old bug)", () => {
    const wt = makeWorktree({
      name: "neo-oracle.wt-1-newfeature",
      lastCommitDate: new Date("2026-03-13T12:00:00Z"), // 1 day ago
    });
    const result = classify(wt, [], now);
    expect(result).toBe("active");
  });

  test("orphan NOT flagged at age 2 days", () => {
    const wt = makeWorktree({
      name: "neo-oracle.wt-1-newfeature",
      lastCommitDate: new Date("2026-03-12T12:00:00Z"), // 2 days ago
    });
    const result = classify(wt, [], now);
    expect(result).toBe("active");
  });

  test("orphan flagged at age 3 days", () => {
    const wt = makeWorktree({
      name: "neo-oracle.wt-1-newfeature",
      lastCommitDate: new Date("2026-03-11T12:00:00Z"), // 3 days ago
    });
    const result = classify(wt, [], now);
    expect(result).toEqual({ reason: "No board match (orphan)" });
  });

  test("stale clean worktree at 7 days → candidate", () => {
    const wt = makeWorktree({
      lastCommitDate: new Date("2026-03-07T12:00:00Z"), // 7 days ago
      dirty: 0,
    });
    const items: BoardItem[] = [{ oracle: "Neo", worktree: "feature", title: "In progress feature", status: "In Progress" }];
    const result = classify(wt, items, now);
    expect(result).toEqual({ reason: "No commits in 7d, clean" });
  });

  test("stale dirty worktree at 7 days → active (dirty != 0, under 14d threshold)", () => {
    const wt = makeWorktree({
      lastCommitDate: new Date("2026-03-07T12:00:00Z"),
      dirty: 3,
    });
    const items: BoardItem[] = [{ oracle: "Neo", worktree: "feature", title: "In progress feature", status: "In Progress" }];
    const result = classify(wt, items, now);
    expect(result).toBe("active");
  });

  test("very stale worktree at 14 days → candidate even if dirty", () => {
    const wt = makeWorktree({
      lastCommitDate: new Date("2026-02-28T12:00:00Z"), // 14 days ago
      dirty: 5,
    });
    const items: BoardItem[] = [{ oracle: "Neo", worktree: "feature", title: "old feature", status: "In Progress" }];
    const result = classify(wt, items, now);
    expect(result).toEqual({ reason: "No commits in 14d" });
  });

  test("fresh worktree with board match → active", () => {
    const wt = makeWorktree({
      lastCommitDate: new Date("2026-03-14T06:00:00Z"), // today
    });
    const items: BoardItem[] = [{ oracle: "Neo", worktree: "feature", title: "feature work", status: "In Progress" }];
    const result = classify(wt, items, now);
    expect(result).toBe("active");
  });

  test("board match by title substring", () => {
    const wt = makeWorktree({
      name: "neo-oracle.wt-1-discord",
      lastCommitDate: new Date("2026-03-14T06:00:00Z"),
    });
    const items: BoardItem[] = [{ oracle: "Neo", title: "P004 Discord Bot Setup", status: "In Progress" }];
    const result = classify(wt, items, now);
    expect(result).toBe("active");
  });
});
