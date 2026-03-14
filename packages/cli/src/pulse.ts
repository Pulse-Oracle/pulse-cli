#!/usr/bin/env bun
/**
 * pulse — GH Projects Master Board CLI
 * Pulse Oracle
 */

import { board, timeline, add, set, fieldAdd, clearDate, scan, autoAssign, init, escalate, heartbeat, resume, remove, close, triage, scheduler, sentry, backfillWt, start, blog, cleanup } from "./commands/index";

const [cmd, ...args] = process.argv.slice(2);

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

switch (cmd) {
  case "board":
  case "b":
    await board(args[0]);
    break;
  case "timeline":
  case "t":
    await timeline(args[0]);
    break;
  case "add":
  case "a": {
    if (!args[0]) {
      console.error("Usage: pulse add <title> [--oracle <name>] [--worktree] [--wt <name>] [--priority <P0-P3>] [--type <task|bug|feature>]");
      process.exit(1);
    }
    await add(args[0], {
      body: parseFlag("--body"),
      oracle: parseFlag("--oracle"),
      repo: parseFlag("--repo"),
      type: parseFlag("--type"),
      priority: parseFlag("--priority"),
      wt: parseFlag("--wt"),
      worktree: args.includes("--worktree"),
    });
    break;
  }
  case "set":
  case "s":
    if (!args[0] || !args[1]) {
      console.error("Usage: pulse set <item#> <value> [value2...]");
      process.exit(1);
    }
    await set(parseInt(args[0]), ...args.slice(1));
    break;
  case "field-add":
  case "fa":
    if (!args[0] || !args[1]) {
      console.error("Usage: pulse field-add <field> <option>");
      process.exit(1);
    }
    await fieldAdd(args[0], args[1]);
    break;
  case "clear":
  case "c":
    if (!args[0]) {
      console.error("Usage: pulse clear <item#> [start|target|both]");
      process.exit(1);
    }
    await clearDate(parseInt(args[0]), (args[1] as "start" | "target" | "both") || "both");
    break;
  case "scan":
    if (args.includes("--auto")) {
      await autoAssign({
        dryRun: args.includes("--dry-run"),
        notify: args.includes("--notify"),
      });
    } else if (args.includes("--mine")) {
      await scan({ mine: true, noCache: args.includes("--no-cache") });
    } else {
      await scan();
    }
    break;
  case "auto-assign":
  case "aa":
    await autoAssign({ dryRun: args.includes("--dry-run") || args.includes("--dry"), notify: args.includes("--notify") });
    break;
  case "init":
    await init();
    break;
  case "escalate":
  case "e": {
    if (!args[0]) {
      console.error("Usage: pulse escalate <title> [--oracle <name>] [--context <text>]");
      process.exit(1);
    }
    await escalate(args[0], {
      oracle: parseFlag("--oracle"),
      context: parseFlag("--context"),
    });
    break;
  }
  case "heartbeat":
  case "hb":
    await heartbeat({ fix: args.includes("--fix") });
    break;
  case "resume": {
    if (!args[0]) {
      console.error("Usage: pulse resume <item#>");
      process.exit(1);
    }
    await resume(parseInt(args[0]));
    break;
  }
  case "remove":
  case "rm": {
    if (!args[0]) {
      console.error("Usage: pulse remove <item#>");
      process.exit(1);
    }
    await remove(parseInt(args[0]));
    break;
  }
  case "close":
  case "done": {
    if (!args[0]) {
      console.error("Usage: pulse close <item#>");
      process.exit(1);
    }
    await close(parseInt(args[0]));
    break;
  }
  case "triage":
  case "tr":
    await triage();
    break;
  case "scheduler":
  case "sched":
    await scheduler(args[0] || "standup", { post: args.includes("--post"), days: parseFlag("--days") ? parseInt(parseFlag("--days")!) : undefined });
    break;
  case "sentry":
  case "monitor":
    await sentry(args[0] || "quick", { post: args.includes("--post") });
    break;
  case "backfill-wt":
  case "bwt":
    await backfillWt({ dry: args.includes("--dry") });
    break;
  case "blog": {
    if (!args[0]) {
      console.error("Usage: pulse blog <file.md> [--title <title>] [--category <category>]");
      process.exit(1);
    }
    await blog(args[0], {
      title: parseFlag("--title"),
      category: parseFlag("--category"),
    });
    break;
  }
  case "start":
  case "go": {
    if (!args[0]) {
      console.error("Usage: pulse start <title> [--oracle <name>] [--worktree] [--wt <name>] [--priority <P0-P3>]");
      process.exit(1);
    }
    await start(args[0], {
      oracle: parseFlag("--oracle"),
      priority: parseFlag("--priority"),
      wt: parseFlag("--wt"),
      worktree: args.includes("--worktree"),
      body: parseFlag("--body"),
      repo: parseFlag("--repo"),
      type: parseFlag("--type"),
    });
    break;
  }
  case "cleanup":
  case "gc":
    await cleanup({ dry: args.includes("--dry") });
    break;
  default:
    console.log(`
  pulse — GH Projects Master Board CLI

  Commands:
    board, b [filter]     Show Master Board (filter by oracle/client/priority)
    timeline, t [filter]  ASCII timeline (filter by oracle/client/priority)
    add, a <title>        Create Issue + add to board
    set, s <#> <values>   Set fields (auto-detect field from value)
    field-add, fa <f> <v> Add option to field (preserves existing values!)
    clear, c <#> [field]  Clear dates (start|target|both)
    scan                  Discover untracked issues across all repos
    scan --mine           Oracle family activity scan (today's commits, cached)
    scan --auto           Auto-assign untracked issues to Oracles
    auto-assign, aa       Route unassigned items to Oracles [--dry-run] [--notify]
    init                  Initialize pulse.config.json (org, project, repos)
    escalate, e <title>   P0 escalation — delegate to oracle
    heartbeat, hb         Check agent health (stale/dead detection)
    resume <#>            Resume paused agent from board item
    remove, rm <#>        Remove item from board
    close, done <#>       Set Done + close GH issue
    triage, tr            Show items missing Priority/Client/Oracle
    scheduler, sched      Daily standup/wrapup/idle detection [--post]
    sentry, monitor       Activity monitor — quick or deep [--post]
    backfill-wt, bwt      Scan disk worktrees + match to board items [--dry]
    start, go <title>     Create issue + set In Progress (track before coding!)
    blog <file.md>        Publish markdown to Discussion (with provenance)
    cleanup, gc [--dry]   Remove stale/orphan worktrees (skips dirty/unpushed)

  Options for add:
    --oracle <name>       Auto-resolve repo + add oracle label
    --repo <owner/repo>   Target repo (overrides oracle mapping)
    --type <type>         Issue type: task, bug, feature
    --body <text>         Issue body
    --worktree            Create new worktree + wake oracle (uses maw wake --new)
    --wt <name>           Wake existing worktree (uses maw wake <oracle> <task>)
    --priority <P0-P3>    Set priority

  Examples:
    pulse board
    pulse board Neo
    pulse add "New task"
    pulse add "Bug fix" --oracle DustBoy --type bug
    pulse add "Feature" --repo laris-co/volt-oracle --type feature
    pulse add "Fix IME bug" --oracle neo --priority P1
    pulse add "Bitkub dashboard" --oracle hermes --wt bitkub
    pulse add "Build dashboard" --oracle neo --worktree
    pulse escalate "Server down" --oracle Homekeeper
    pulse escalate "Pipeline broken" --oracle Homekeeper --context "mqtt.laris.co OOM"
    pulse hb
    pulse hb --fix
    pulse resume 3
    pulse set 1 P0 Bitkub Hermes
    pulse clear 3 both
    pulse scan
`);
}
