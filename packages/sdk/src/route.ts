/**
 * route.ts — Intelligent issue-to-oracle routing
 *
 * Priority: label override → repo match → keyword match → default
 */

export interface RoutingRule {
  match: string[];
  oracle: string;
}

export interface RoutingConfig {
  repo: Record<string, string>;
  keyword: RoutingRule[];
  label: RoutingRule[];
  default: string;
}

export interface RouteInput {
  title: string;
  repo: string;
  labels?: string[];
}

export interface RouteResult {
  oracle: string;
  reason: "label" | "repo" | "keyword" | "default";
  matched?: string;
}

/**
 * Route an issue to the appropriate Oracle.
 *
 * Priority order:
 * 1. Label match (e.g., label "oracle/neo" → Neo)
 * 2. Repo match (e.g., repo "homelab" → Homekeeper)
 * 3. Keyword match in title (e.g., "deploy server" → Homekeeper)
 * 4. Default fallback (usually Pulse as PM)
 */
export function route(input: RouteInput, config: RoutingConfig): RouteResult {
  const { title, repo, labels = [] } = input;
  const titleLower = title.toLowerCase();
  const labelsLower = labels.map((l) => l.toLowerCase());

  // 1. Label override
  for (const rule of config.label) {
    for (const pattern of rule.match) {
      if (labelsLower.some((l) => l.includes(pattern.toLowerCase()))) {
        return { oracle: rule.oracle, reason: "label", matched: pattern };
      }
    }
  }

  // 2. Repo match
  const repoName = repo.includes("/") ? repo.split("/").pop()! : repo;
  const repoLower = repoName.toLowerCase();
  for (const [repoPattern, oracle] of Object.entries(config.repo)) {
    if (repoLower === repoPattern.toLowerCase() || repoLower.includes(repoPattern.toLowerCase())) {
      return { oracle, reason: "repo", matched: repoPattern };
    }
  }

  // 3. Keyword match in title
  for (const rule of config.keyword) {
    for (const kw of rule.match) {
      if (titleLower.includes(kw.toLowerCase())) {
        return { oracle: rule.oracle, reason: "keyword", matched: kw };
      }
    }
  }

  // 4. Default fallback
  return { oracle: config.default, reason: "default" };
}
