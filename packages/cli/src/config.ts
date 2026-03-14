import { join } from "path";
import { homedir } from "os";
import type { PulseContext, RoutingConfig } from "@pulse-oracle/sdk";

export interface PulsePeer {
  org: string;
  projectNumber: number;
  label?: string;
}

export interface PulseConfig {
  org: string;
  projectNumber: number;
  repoName?: string;
  oracleRepos: Record<string, string>;
  routing?: RoutingConfig;
  peers?: PulsePeer[];
  labels?: {
    oracleColor?: string;
    p0Color?: string;
  };
  blog?: {
    repo?: string;
    category?: string;
  };
}

// ─── Derived helpers ────────────────────────

/** Get the current repo name (from config or default) */
export function getRepoName(): string {
  return loadConfig().repoName || "pulse-oracle";
}

/** Invert oracleRepos: repo-name → Oracle Name (capitalized) */
export function getRepoToOracle(): Record<string, string> {
  const repos = loadConfig().oracleRepos;
  const map: Record<string, string> = {};
  for (const [oracle, repo] of Object.entries(repos)) {
    map[repo.toLowerCase()] = oracle.charAt(0).toUpperCase() + oracle.slice(1);
  }
  return map;
}

export const LABEL_COLORS = {
  get oracle() { return loadConfig().labels?.oracleColor || "5319e7"; },
  get p0() { return loadConfig().labels?.p0Color || "d73a49"; },
};

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

/** Get the ghq root (code directory) — uses `ghq root` or falls back to ~/Code */
let _ghqRoot: string | null = null;
export function getGhqRoot(): string {
  if (_ghqRoot) return _ghqRoot;
  try {
    const proc = Bun.spawnSync(["ghq", "root"], { stdout: "pipe", stderr: "pipe" });
    const out = new TextDecoder().decode(proc.stdout).trim();
    if (out) { _ghqRoot = out; return out; }
  } catch { /* ghq not available */ }
  _ghqRoot = join(homedir(), "Code");
  return _ghqRoot;
}

/** Get the org directory: <ghqRoot>/github.com/<org> */
export function getOrgDir(): string {
  return join(getGhqRoot(), "github.com", loadConfig().org);
}
