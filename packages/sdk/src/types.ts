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
}

export interface ProjectField {
  id: string;
  name: string;
  type: string;
  options?: { id: string; name: string }[];
}
