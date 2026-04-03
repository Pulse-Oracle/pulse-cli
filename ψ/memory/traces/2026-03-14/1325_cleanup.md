---
query: "cleanup"
target: "pulse-cli"
mode: deep
timestamp: 2026-03-14 13:25
---

# Trace: cleanup

**Target**: pulse-cli
**Mode**: deep (5 parallel agents + Oracle search)
**Time**: 2026-03-14 13:25 +07

## Oracle Results

- **retro: worktree-skill-creation** (oracle-skills-cli) — `/worktree` skill created with orphan cleanup in installer.ts, leftover `agents/1` branch blocker resolved
- **learning: maw-worktree-setup** — Documented `git worktree remove`, stale worktree pruning, "branch already exists" troubleshooting
- **retro: infra-cleanup-triage** (homelab) — Worktree wt-1/wt-2 removal noted as pending
- **learning: dig-worktree-session-archaeology** (shrimp-oracle) — Claude Code creates separate project dirs per worktree, dig must scan all

## Files Found

### Core Cleanup System (pulse-cli)
| File | Purpose |
|------|---------|
| `packages/cli/src/commands/cleanup.ts` | Main cleanup — stale/orphan detection, safety checks, tmux integration |
| `packages/cli/tests/cleanup.test.ts` | 13 tests — classification logic, threshold validation |
| `packages/cli/src/worktree.ts` | Worktree scanner — discovery, branch/dirty/commit analysis |
| `packages/cli/src/maw.ts` | `mawPeek()` — tmux session alive check |
| `packages/cli/src/commands/heartbeat.ts` | Agent health — ACTIVE/STALE/DEAD classification via mawPeek |
| `packages/cli/src/commands/scheduler.ts` | Idle reporting — 3+ day idle detection |
| `packages/cli/src/pulse.ts` | CLI dispatch — `cleanup`/`gc` with `--dry` flag |

### Cross-Repo Cleanup Implementations
| Repo | File | Strategy |
|------|------|----------|
| maw-js | `src/worktrees.ts` | `git worktree list --porcelain`, orphan scanning |
| maw-js | `src/commands/done.ts` | `git worktree remove --force` + branch delete |
| homelab | `scripts/cleanup-stale-processes.sh` | Orphaned process detection (Claude, MCP, Chrome) |

## Git History

### Key Commits
- **2229c93** `fix: cleanup checks tmux + asks human, blog prints ACTION REQUIRED` — THE FIX
- **35ace3e** `fix: cleanup checks tmux before removing + asks human instead of auto-delete`
- **8f0fb81** `feat: full CLI migration — 22 commands, Thai display, fleet orchestration`

## GitHub Issues/PRs

### pulse-cli
- **#5 (OPEN)** — `pulse cleanup deleted active worktree while Neo was running` — the bug report
- **#4 (MERGED)** — Full CLI migration PR

### maw-js (downstream)
- **#26 (OPEN)** — `maw wake fails when branch already exists from cleaned-up worktree`
- **#25 (OPEN)** — `maw ls should detect orphaned worktree directories`
- **#23 (OPEN)** — RFC: maw lifecycle — assign, auto-done, follow, handoff, pr, hooks
- **#21 (CLOSED)** — Case-insensitive session detection + cleanup integration
- **#19 (CLOSED)** — Pulse cleanup in maw UI — worktree hygiene dashboard
- **#20 (MERGED)** — feat: worktree hygiene dashboard
- **#22 (MERGED)** — fix: case-insensitive session/window name matching

## Session Timeline (dig)

| # | Date | Session | Min | Repo | Focus |
|---|------|---------|-----|------|-------|
| 1 | 02-10 | 12:05–14:07 | 5642m | cli | Fix #42: /rrr --dig path encoding + worktree awareness |
| 2 | 03-14 | 12:12–12:13 | 0m | mawjs | Issue #21: case-insensitive session detection + cleanup |
| 3 | 03-14 | 12:59–13:26 | 26m | mawjs | Neo worktree broke by cleanup — fix session |
| 4 | 03-14 | 13:02–13:26 | 24m | cli | THIS SESSION — cleanup bugs + fixes |

28 additional sessions across repos mention cleanup/worktree keywords (homelab, oracle, v2, Agents).

## Summary

### What Happened
1. **Bug**: `pulse cleanup` auto-deleted Neo's active worktree (neo-oracle.wt-1-mawjs) while Neo was running inside it
2. **Root cause**: No tmux session check before deletion, no human confirmation
3. **Fix applied** (2229c93): Added `mawPeek()` check + changed to ACTION REQUIRED (never auto-delete)
4. **This session**: Added 3 more safety layers — orphan grace period (1d→3d), unpushed commits check, `--dry` flag

### Design Principles (current)
1. **Nothing auto-deleted** — prints `maw done` commands for human
2. **Board-aware** — matches worktrees to GH Projects items
3. **Agent-aware** — checks tmux via `mawPeek()` before suggesting
4. **Data-safe** — skips dirty worktrees AND unpushed commits
5. **Conservative timing** — 3-day orphan grace, 7-day stale, 14-day override

### Open Issues
- **maw-js #26**: `maw wake` fails when branch exists from cleaned-up worktree (downstream)
- **maw-js #25**: `maw ls` doesn't detect orphaned `.wt-*` dirs
