import { route } from "@pulse-oracle/sdk";
import type { RoutingConfig, RouteResult } from "@pulse-oracle/sdk";
import { loadConfig } from "./config";

/**
 * Resolve oracle name using SDK's 4-tier routing:
 * label → repo → keyword → default
 */
export function resolveOracle(
  title: string,
  opts?: { repo?: string; labels?: string[] }
): RouteResult {
  const config = loadConfig();
  const routing = config.routing;

  if (!routing) {
    return { oracle: "Pulse", reason: "default" };
  }

  return route(
    { title, repo: opts?.repo || "", labels: opts?.labels || [] },
    routing
  );
}
