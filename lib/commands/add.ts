import { getOracleRepos } from "../types";
import { getProjectNumber, getOrg, gh, getIssueTypes, setIssueType } from "../github";

export async function add(title: string, opts: { body?: string; oracle?: string; repo?: string; type?: string } = {}) {
  const org = getOrg();
  let targetRepo = opts.repo;
  if (!targetRepo && opts.oracle) {
    const repoName = getOracleRepos()[opts.oracle.toLowerCase()];
    if (repoName) targetRepo = `${org}/${repoName}`;
  }
  if (!targetRepo) targetRepo = `${org}/pulse-oracle`;

  // Ensure oracle label exists on target repo
  if (opts.oracle) {
    const labelName = `oracle:${opts.oracle}`;
    try {
      await gh("label", "create", "--repo", targetRepo, labelName, "--color", "5319e7", "--force");
    } catch { /* label may already exist */ }
  }

  const issueArgs = [
    "issue", "create", "--repo", targetRepo, "--title", title,
    "--body", opts.body || `Created by Pulse Oracle`,
  ];
  if (opts.oracle) issueArgs.push("--label", `oracle:${opts.oracle}`);

  const issueUrl = await gh(...issueArgs);
  console.log(`Created: ${issueUrl}`);

  // Set issue type if specified
  if (opts.type) {
    const types = await getIssueTypes();
    const match = types.find(t => t.name.toLowerCase() === opts.type!.toLowerCase());
    if (match) {
      const issueJson = await gh("issue", "view", issueUrl.trim(), "--json", "id");
      const issueNodeId = JSON.parse(issueJson).id;
      await setIssueType(issueNodeId, match.id);
      console.log(`Type: ${match.name}`);
    } else {
      console.log(`Type "${opts.type}" not found. Available: ${types.map(t => t.name).join(", ")}`);
    }
  }

  await gh("project", "item-add", String(getProjectNumber()), "--owner", org, "--url", issueUrl.trim());
  console.log(`Added to Master Board: "${title}"`);
}
