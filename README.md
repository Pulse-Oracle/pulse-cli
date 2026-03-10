# pulse-cli

GH Projects Master Board CLI — manage GitHub Project issues, timelines, and boards from the terminal.

## Requirements

- [Bun](https://bun.sh) runtime
- [GitHub CLI](https://cli.github.com) (`gh`) authenticated

## Quick Start

```bash
git clone https://github.com/laris-co/pulse-cli
cd pulse-cli
bun pulse.ts init
```

`pulse init` will ask for your GitHub org/user and project number, then auto-discover repos.

## Commands

```
pulse board [filter]     Show Master Board (filter by oracle/client/priority)
pulse timeline [filter]  ASCII timeline with colored bars
pulse add <title>        Create Issue + add to board
pulse set <#> <values>   Set fields on an item
pulse field-add <f> <v>  Add option to a select field
pulse clear <#> [field]  Clear date fields
pulse scan               Discover untracked issues across repos
pulse init               Setup pulse.config.json
```

## Options for `add`

```
--oracle <name>       Auto-resolve repo from config + add label
--repo <owner/repo>   Target repo (overrides oracle mapping)
--type <type>         Issue type: task, bug, feature
--body <text>         Issue body text
```

## Examples

```bash
# View your board
bun pulse.ts board

# Filter by team member
bun pulse.ts board Neo

# ASCII Gantt chart
bun pulse.ts timeline

# Create issue on a specific repo
bun pulse.ts add "Fix login bug" --oracle Backend --type bug

# Set fields on item #3
bun pulse.ts set 3 P0 Urgent

# Find issues not on the board
bun pulse.ts scan
```

## Config

`pulse.config.json` (created by `pulse init`):

```json
{
  "org": "your-org",
  "projectNumber": 1,
  "oracleRepos": {
    "frontend": "frontend-repo",
    "backend": "backend-api"
  }
}
```

The `oracleRepos` map lets `--oracle Frontend` auto-resolve to `your-org/frontend-repo`.

## Architecture

```
pulse.ts              Entry point (arg parsing)
lib/
  config.ts           Config loader (pulse.config.json)
  github.ts           gh/GraphQL helpers + data fetchers
  types.ts            TypeScript interfaces
  format.ts           Date formatting, color codes, bar calculations
  filter.ts           Filter + group by priority
  commands/
    board.ts          Board table view
    timeline.ts       ASCII Gantt chart
    add.ts            Create issue + add to board
    set.ts            Set fields on items
    field-add.ts      Add select field options (with backup/restore)
    clear.ts          Clear date fields
    scan.ts           Discover untracked issues
    init.ts           Interactive setup
```

## Tests

```bash
bun test tests/
```

## License

MIT
