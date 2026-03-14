import type { PulseContext, ProjectItem, ProjectField } from "./types";

// ─── Low-level helpers ───────────────────────────────

export async function gh(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0 && err) throw new Error(err.trim());
  return out.trim();
}

export async function ghJson<T = any>(...args: string[]): Promise<T> {
  const out = await gh(...args);
  return JSON.parse(out);
}

export async function graphql<T = any>(query: string): Promise<T> {
  const out = await gh("api", "graphql", "-f", `query=${query}`);
  return JSON.parse(out);
}

// ─── Data fetchers ───────────────────────────────────

export async function getItems(ctx: PulseContext): Promise<ProjectItem[]> {
  const data = await ghJson(
    "project", "item-list", String(ctx.projectNumber), "--owner", ctx.org, "--limit", "100", "--format", "json"
  );
  const items: ProjectItem[] = data.items;

  const projectData = await ghJson(
    "project", "view", String(ctx.projectNumber), "--owner", ctx.org, "--format", "json"
  );

  const gqlResult = await graphql(`{
    node(id: "${projectData.id}") {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue { repository { name } }
              ... on PullRequest { repository { name } }
            }
            startDate: fieldValueByName(name: "Start Date") {
              ... on ProjectV2ItemFieldDateValue { date }
            }
            targetDate: fieldValueByName(name: "Target Date") {
              ... on ProjectV2ItemFieldDateValue { date }
            }
            worktree: fieldValueByName(name: "Worktree") {
              ... on ProjectV2ItemFieldTextValue { text }
            }
          }
        }
      }
    }
  }`);

  const extraMap = new Map<string, { start: string; target: string; worktree: string; repo: string }>();
  for (const node of gqlResult.data.node.items.nodes) {
    extraMap.set(node.id, {
      start: node.startDate?.date || "",
      target: node.targetDate?.date || "",
      worktree: node.worktree?.text || "",
      repo: node.content?.repository?.name || "",
    });
  }

  for (const item of items) {
    const extra = extraMap.get(item.id);
    if (extra) {
      item["start date"] = extra.start;
      item["target date"] = extra.target;
      item.worktree = extra.worktree;
      item.repo = extra.repo;
    }
  }

  return items;
}

export async function getFields(ctx: PulseContext): Promise<ProjectField[]> {
  const data = await ghJson(
    "project", "field-list", String(ctx.projectNumber), "--owner", ctx.org, "--format", "json"
  );
  return data.fields;
}

export async function getProjectId(ctx: PulseContext): Promise<string> {
  const data = await ghJson(
    "project", "view", String(ctx.projectNumber), "--owner", ctx.org, "--format", "json"
  );
  return data.id;
}

export async function getIssueTypes(ctx: PulseContext): Promise<{ id: string; name: string }[]> {
  const result = await graphql(`{
    organization(login: "${ctx.org}") {
      issueTypes(first: 20) {
        nodes { id name }
      }
    }
  }`);
  return result.data.organization.issueTypes.nodes;
}

export async function setIssueType(issueNodeId: string, typeId: string) {
  await graphql(`mutation { updateIssue(input: { id: "${issueNodeId}", issueTypeId: "${typeId}" }) { issue { id } } }`);
}

// ─── Field setters ───────────────────────────────────

export async function setTextField(ctx: PulseContext, itemId: string, fieldName: string, value: string) {
  const projectId = await getProjectId(ctx);
  const fields = await getFields(ctx);
  const field = fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
  if (!field) {
    console.error(`Field "${fieldName}" not found on project`);
    return;
  }
  await graphql(`mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "${projectId}",
      itemId: "${itemId}",
      fieldId: "${field.id}",
      value: { text: "${value.replace(/"/g, '\\"')}" }
    }) { projectV2Item { id } }
  }`);
}

export async function setFieldOnItem(ctx: PulseContext, itemId: string, fieldName: string, value: string): Promise<void> {
  const fields = await getFields(ctx);
  const projectId = await getProjectId(ctx);
  const field = fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
  if (!field) {
    console.error(`Field "${fieldName}" not found on project`);
    return;
  }

  // TEXT field (no options)
  if (!field.options) {
    await graphql(`mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}",
        itemId: "${itemId}",
        fieldId: "${field.id}",
        value: { text: "${value.replace(/"/g, '\\"')}" }
      }) { projectV2Item { id } }
    }`);
    return;
  }

  // SingleSelect field
  const opt = field.options.find(o => o.name.toLowerCase() === value.toLowerCase());
  if (!opt) {
    console.error(`Option "${value}" not found for field "${fieldName}"`);
    return;
  }
  await gh(
    "project", "item-edit", "--project-id", projectId,
    "--id", itemId, "--field-id", field.id,
    "--single-select-option-id", opt.id,
  );
}
