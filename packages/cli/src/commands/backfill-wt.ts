import { getItems, setTextField } from "@pulse-oracle/sdk";
import { getContext } from "../config";
import { scanWorktrees, extractSlug } from "../worktree";

export async function backfillWt(opts: { dry?: boolean } = {}) {
  const ctx = getContext();
  const items = await getItems(ctx);
  const worktrees = scanWorktrees().filter(w => !w.isMain);

  console.log(`\n  Scanning ${worktrees.length} worktrees against ${items.length} board items...\n`);

  const unset = items.filter(i => !i.worktree && i.oracle);
  let matched = 0;

  for (const item of unset) {
    const oracleWts = worktrees.filter(w => w.oracle === item.oracle);

    for (const wt of oracleWts) {
      const slug = extractSlug(wt.name);
      if (!slug) continue;

      if (item.title.toLowerCase().includes(slug.toLowerCase())) {
        console.log(`  Match: "${item.title}" -> ${wt.name} (slug: ${slug})`);
        matched++;

        if (!opts.dry) {
          await setTextField(ctx, item.id, "Worktree", slug);
          console.log(`    -> Set worktree = "${slug}"`);
        }
        break;
      }
    }
  }

  console.log(`\n  ${matched} match(es) found${opts.dry ? " (dry run — no changes)" : ""}`);
}
