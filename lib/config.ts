import { join } from "path";

export interface PulseConfig {
  org: string;
  projectNumber: number;
  oracleRepos: Record<string, string>;
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
