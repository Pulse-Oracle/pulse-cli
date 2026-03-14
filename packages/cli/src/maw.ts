/** maw — shared inter-Oracle communication helpers */

export async function mawWake(oracle: string, wakeOpts: { task?: string; newWt?: string } = {}): Promise<string | null> {
  const args = ["wake", oracle];
  if (wakeOpts.newWt) args.push("--new", wakeOpts.newWt);
  else if (wakeOpts.task) args.push(wakeOpts.task);

  const proc = Bun.spawn(["maw", ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;

  if (proc.exitCode !== 0) {
    console.error(`maw wake failed: ${err.trim()}`);
    return null;
  }
  console.log(out.trim());
  return out.trim();
}

export async function mawHey(target: string, message: string): Promise<void> {
  const proc = Bun.spawn(["maw", "hey", target, message], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  if (out.trim()) console.log(out.trim());
}

export async function mawPeek(target: string): Promise<{ alive: boolean; content?: string }> {
  const proc = Bun.spawn(["maw", "peek", target], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  if (proc.exitCode !== 0) return { alive: false };
  return { alive: true, content: out.trim() };
}
