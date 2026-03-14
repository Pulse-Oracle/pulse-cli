import { gh, getItems, getFields, getProjectId } from "@pulse-oracle/sdk";
import { getContext } from "../config";
import { mawPeek } from "../maw";
import { readFileSync } from "fs";
import { homedir } from "os";

interface AgentStatus {
  index: number;
  title: string;
  oracle: string;
  lastActivity: Date | null;
  sessionAlive: boolean;
  classification: "ACTIVE" | "STALE" | "DEAD";
}

const STALE_MINUTES = 15;

function getLastActivity(): Map<string, Date> {
  const feedPath = `${homedir()}/.oracle/feed.log`;
  const activity = new Map<string, Date>();
  try {
    const lines = readFileSync(feedPath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split(" | ");
      if (parts.length < 3) continue;
      const timestamp = parts[0].trim();
      const oracle = parts[1].trim();
      const date = new Date(timestamp.replace(" ", "T") + "+07:00");
      if (!isNaN(date.getTime())) {
        activity.set(oracle, date);
      }
    }
  } catch { /* no feed.log */ }
  return activity;
}

function formatAgo(date: Date | null): string {
  if (!date) return "(no data)";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function heartbeat(opts: { fix?: boolean } = {}) {
  const ctx = getContext();
  const items = await getItems(ctx);
  const inProgress = items
    .map((item, i) => ({ item, index: i + 1 }))
    .filter(({ item }) => item.status === "In Progress");

  if (inProgress.length === 0) {
    console.log("  No items In Progress.");
    return;
  }

  const activity = getLastActivity();
  const now = Date.now();
  const statuses: AgentStatus[] = [];

  for (const { item, index } of inProgress) {
    const oracle = (item.oracle || "").toLowerCase();
    const windowName = `${oracle}-oracle`;

    const peek = await mawPeek(windowName);

    const lastDate = activity.get(oracle) || null;
    const minutesAgo = lastDate ? (now - lastDate.getTime()) / 60000 : Infinity;

    let classification: AgentStatus["classification"];
    if (!peek.alive) {
      classification = "DEAD";
    } else if (minutesAgo > STALE_MINUTES) {
      classification = "STALE";
    } else {
      classification = "ACTIVE";
    }

    statuses.push({
      index,
      title: item.title,
      oracle: item.oracle || "—",
      lastActivity: lastDate,
      sessionAlive: peek.alive,
      classification,
    });
  }

  const staleOrDead = statuses.filter(s => s.classification !== "ACTIVE");
  console.log(`\n  Pulse -- Heartbeat  (${inProgress.length} in-progress, ${staleOrDead.length} need attention)\n`);

  const hdr = "  #".padEnd(5) + "Title".padEnd(40) + "Oracle".padEnd(14) + "Last Activity".padEnd(18) + "Status";
  console.log(hdr);
  console.log("  " + "─".repeat(hdr.length - 2));

  for (const s of statuses) {
    const icon = s.classification === "ACTIVE" ? "\x1b[32m●\x1b[0m" :
                 s.classification === "STALE" ? "\x1b[33m●\x1b[0m" : "\x1b[31m●\x1b[0m";
    const title = s.title.length > 38 ? s.title.slice(0, 35) + "..." : s.title;
    console.log(
      `  ${String(s.index).padEnd(4)}${title.padEnd(40)}${s.oracle.padEnd(14)}${formatAgo(s.lastActivity).padEnd(18)}${icon} ${s.classification}`
    );
  }
  console.log();

  if (opts.fix && staleOrDead.length > 0) {
    const fields = await getFields(ctx);
    const projectId = await getProjectId(ctx);
    const statusField = fields.find(f => f.name === "Status");
    const pausedOpt = statusField?.options?.find(o => o.name === "Paused");

    if (!pausedOpt) {
      console.error("  'Paused' status option not found on board. Add it first.");
      return;
    }

    const deadItems = statuses.filter(s => s.classification === "DEAD");
    for (const s of deadItems) {
      const item = items[s.index - 1];

      await gh(
        "project", "item-edit", "--project-id", projectId,
        "--id", item.id, "--field-id", statusField!.id,
        "--single-select-option-id", pausedOpt.id,
      );

      const issueUrl = (item as any).content?.url;
      if (issueUrl) {
        const comment = `Agent paused — no active session detected (last activity: ${formatAgo(s.lastActivity)}).\n\nResume with: \`pulse resume ${s.index}\`\n\n_Detected by \`pulse heartbeat --fix\`_`;
        try {
          await gh("issue", "comment", issueUrl, "--body", comment);
        } catch { /* issue may not be accessible */ }
      }

      console.log(`  → Paused: "${s.title}" (${s.classification})`);
    }
    console.log();
  }
}
