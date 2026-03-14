import { gh } from "./github";

export async function ensureLabel(repo: string, name: string, color: string = "5319e7"): Promise<void> {
  try {
    await gh("label", "create", "--repo", repo, name, "--color", color, "--force");
  } catch { /* label may already exist */ }
}
