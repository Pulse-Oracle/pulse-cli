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
    "project", "item-list", String(ctx.projectNumber), "--owner", ctx.org, "--format", "json"
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
            startDate: fieldValueByName(name: "Start Date") {
              ... on ProjectV2ItemFieldDateValue { date }
            }
            targetDate: fieldValueByName(name: "Target Date") {
              ... on ProjectV2ItemFieldDateValue { date }
            }
          }
        }
      }
    }
  }`);

  const dateMap = new Map<string, { start: string; target: string }>();
  for (const node of gqlResult.data.node.items.nodes) {
    dateMap.set(node.id, {
      start: node.startDate?.date || "",
      target: node.targetDate?.date || "",
    });
  }

  for (const item of items) {
    const dates = dateMap.get(item.id);
    if (dates) {
      item["start date"] = dates.start;
      item["target date"] = dates.target;
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
