import { saveConfig } from "../config";
import type { PulseConfig } from "../config";
import { gh } from "@pulse-oracle/sdk";
import * as readline from "readline";

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function init() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const org = await ask(rl, "GitHub org or user: ");
    if (!org.trim()) {
      console.error("Org is required.");
      return;
    }

    const numStr = await ask(rl, "Project number: ");
    const projectNumber = parseInt(numStr.trim());
    if (isNaN(projectNumber)) {
      console.error("Project number must be a number.");
      return;
    }

    // Auto-discover oracle repos
    console.log(`\nDiscovering oracle repos in ${org.trim()}...`);
    const reposJson = await gh("repo", "list", org.trim(), "--json", "name", "--limit", "200");
    const repos: { name: string }[] = JSON.parse(reposJson);
    const oracleNames = repos
      .filter((r) => r.name.toLowerCase().includes("oracle"))
      .map((r) => r.name);

    const oracleRepos: Record<string, string> = {};
    for (const name of oracleNames) {
      const key = name.toLowerCase().replace(/-oracle$/, "").replace(/oracle-?/, "");
      oracleRepos[key || name.toLowerCase()] = name;
    }

    if (oracleNames.length > 0) {
      console.log(`\nFound ${oracleNames.length} oracle repos:`);
      for (const [key, repo] of Object.entries(oracleRepos)) {
        console.log(`  ${key} => ${repo}`);
      }
      const confirm = await ask(rl, "\nUse these? (Y/n) ");
      if (confirm.trim().toLowerCase() === "n") {
        console.log("Aborted. Edit pulse.config.json manually.");
        return;
      }
    } else {
      console.log("No oracle repos found. You can add them to pulse.config.json later.");
    }

    const config: PulseConfig = {
      org: org.trim(),
      projectNumber,
      oracleRepos,
    };

    saveConfig(config);
    console.log("\nSaved pulse.config.json");
  } finally {
    rl.close();
  }
}
