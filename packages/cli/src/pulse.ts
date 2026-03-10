#!/usr/bin/env bun
/**
 * pulse — GH Projects Master Board CLI
 * Pulse Oracle
 */

import { board, timeline, add, set, fieldAdd, clearDate, scan, init } from "./commands/index";

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
      console.error("Usage: pulse add <title> [--body <body>] [--oracle <name>] [--repo <owner/repo>] [--type <task|bug|feature>]");
      process.exit(1);
    }
    await add(args[0], {
      body: parseFlag("--body"),
      oracle: parseFlag("--oracle"),
      repo: parseFlag("--repo"),
      type: parseFlag("--type"),
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
    await scan();
    break;
  case "init":
    await init();
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
    init                  Initialize pulse.config.json (org, project, repos)

  Options for add:
    --oracle <name>       Auto-resolve repo + add oracle label
    --repo <owner/repo>   Target repo (overrides oracle mapping)
    --type <type>         Issue type: task, bug, feature
    --body <text>         Issue body

  Examples:
    pulse board
    pulse board Neo
    pulse add "New task"
    pulse add "Bug fix" --oracle DustBoy --type bug
    pulse add "Feature" --repo laris-co/volt-oracle --type feature
    pulse set 1 P0 Bitkub Hermes
    pulse clear 3 both
    pulse scan
`);
}
