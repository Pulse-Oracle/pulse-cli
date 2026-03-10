export interface ProjectItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  client: string;
  oracle: string;
  "start date": string;
  "target date": string;
}

export interface ProjectField {
  id: string;
  name: string;
  type: string;
  options?: { id: string; name: string }[];
}

import { loadConfig } from "./config";

/** Oracle name (lowercase) → repo name in org (from config) */
export function getOracleRepos(): Record<string, string> {
  return loadConfig().oracleRepos;
}
