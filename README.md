# Pulse CLI

Project heartbeat for the Oracle family — manage GitHub Projects V2 from the terminal.

**Docs**: https://pulse.buildwithoracle.com
**Board**: [Master Board](https://github.com/orgs/laris-co/projects/6)

## Requirements

- [Bun](https://bun.sh) runtime
- [GitHub CLI](https://cli.github.com) (`gh`) authenticated

## Quick Start

```bash
git clone https://github.com/Pulse-Oracle/pulse-cli
cd pulse-cli
bun install
bun packages/cli/src/pulse.ts init
```

## Commands (22)

### Core — Task Management

```
pulse add <title>          Create Issue + add to board
pulse start <title>        Create issue + set In Progress (track before you build)
pulse close <#>            Mark as Done + close issue
pulse set <#> <values>     Set fields (status, priority, client, oracle, dates)
pulse remove <#>           Remove item from board
pulse clear <#> [field]    Clear date fields
```

### Board — Visibility

```
pulse board [filter]       Show Master Board (filter by oracle/client/priority)
pulse timeline [filter]    ASCII Gantt chart with colored bars
pulse triage               Show items missing priority/client/oracle
pulse scan                 Discover untracked issues across repos
```

### Fleet — Agent Management

```
pulse heartbeat [--fix]    Check agent health (ACTIVE/STALE/DEAD)
pulse escalate <title>     P0 escalation — create issue + spawn agent
pulse resume <#>           Wake paused agent + set In Progress
pulse cleanup [--dry]      Remove stale worktrees across all Oracles
pulse auto-assign          Route unassigned items to Oracles
pulse sentry               Hourly agent map (posts to Discussion)
```

### Ops — Setup & Maintenance

```
pulse init                 Setup pulse.config.json
pulse field-add <f> <v>    Add option to select field (with backup/restore)
pulse scheduler            Daily cron (standup + wrapup to Discussion)
pulse blog <file.md>       Publish markdown to GitHub Discussion
pulse backfill-wt          Match board items to worktrees
```

## Flags

```
--oracle <name>       Target oracle (auto-resolves repo from config)
--repo <owner/repo>   Target repo (overrides oracle)
--priority P0-P3      Set priority level
--client <name>       Set client
--type task|bug|feature
--worktree            Create new worktree + wake agent
```

## Architecture

```
Pulse-Oracle/pulse-cli/
  packages/
    sdk/              @pulse-oracle/sdk
      src/
        types.ts        Type definitions
        github.ts       GitHub API (GraphQL, Projects V2)
        format.ts       Display formatting (Thai-aware)
        filter.ts       Item filtering + grouping
        route.ts        Oracle routing logic
        labels.ts       Label management
        discussion.ts   Discussion API
    cli/              @pulse-oracle/cli
      src/
        commands/       22 commands
        pulse.ts        Entry point
```

## Config

`pulse.config.json` (created by `pulse init`):

```json
{
  "org": "your-org",
  "projectNumber": 1,
  "oracleRepos": {
    "neo": "neo-oracle",
    "hermes": "hermes-oracle"
  },
  "routing": {
    "repo": { "neo-oracle": "Neo" },
    "keyword": [{ "match": ["code", "bug"], "oracle": "Neo" }],
    "default": "Pulse"
  }
}
```

## Tests

```bash
bun test    # 28 tests (format: 16, filter: 12)
```

## License

MIT
