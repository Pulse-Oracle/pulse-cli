import { join } from "path";
import type { PulseContext } from "@pulse-oracle/sdk";

import type { RoutingConfig } from "@pulse-oracle/sdk";

export interface PulsePeer {
  org: string;
  projectNumber: number;
  label?: string;
}

export interface PulseConfig {
  org: string;
  projectNumber: number;
  oracleRepos: Record<string, string>;
  routing?: RoutingConfig;
  peers?: PulsePeer[];
}

const CONFIG_FILE = "pulse.config.json";

function configPath(): string {
  return join(process.cwd(), CONFIG_FILE);
}

let _cached: PulseConfig | null = null;

export function loadConfig(): PulseConfig {
  if (_cached) return _cached;

  const path = configPath();
  try {
    const raw = require(path);
    _cached = raw as PulseConfig;
    return _cached;
  } catch {
    console.error(`Missing ${CONFIG_FILE} in current directory.`);
    console.error(`Run \`pulse init\` first.`);
    process.exit(1);
  }
}

export function saveConfig(config: PulseConfig): void {
  Bun.write(configPath(), JSON.stringify(config, null, 2) + "\n");
  _cached = config;
}

/** Reset cached config (for testing) */
export function _resetCache(): void {
  _cached = null;
}

/** Get PulseContext from config for SDK functions */
export function getContext(): PulseContext {
  const cfg = loadConfig();
  return { org: cfg.org, projectNumber: cfg.projectNumber };
}

/** Oracle name (lowercase) → repo name in org (from config) */
export function getOracleRepos(): Record<string, string> {
  return loadConfig().oracleRepos;
}

/** Get all contexts: primary + peers */
export function getAllContexts(): { ctx: PulseContext; label: string }[] {
  const cfg = loadConfig();
  const all = [{ ctx: { org: cfg.org, projectNumber: cfg.projectNumber }, label: cfg.org }];
  for (const peer of cfg.peers || []) {
    all.push({ ctx: { org: peer.org, projectNumber: peer.projectNumber }, label: peer.label || peer.org });
  }
  return all;
}
