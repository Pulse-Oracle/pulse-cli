export interface PulseContext {
  org: string;
  projectNumber: number;
}

export interface ProjectItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  client: string;
  oracle: string;
  "start date": string;
  "target date": string;
  worktree: string;
  repo: string;
}

export interface ProjectField {
  id: string;
  name: string;
  type: string;
  options?: { id: string; name: string }[];
}

export interface AddOpts {
  body?: string;
  oracle?: string;
  repo?: string;
  type?: string;
  wt?: string;
  worktree?: boolean;
  priority?: string;
}

export interface EscalateOpts {
  oracle?: string;
  context?: string;
}

export interface SchedulerOpts {
  post?: boolean;
  days?: number;
}

export interface BlogOpts {
  category?: string;
  title?: string;
}
