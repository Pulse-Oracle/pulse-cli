import { fmtDateRange, priorityColor, calcBar, filterItems, getItems, padDisplay, sliceDisplay } from "@pulse-oracle/sdk";
import { getContext } from "../config";

export async function timeline(filter?: string) {
  let items = await getItems(getContext());
  if (filter) items = filterItems(items, filter);

  const dated = items
    .filter((i) => i["start date"] && i["target date"])
    .sort((a, b) => new Date(a["start date"]).getTime() - new Date(b["start date"]).getTime());

  if (dated.length === 0) {
    console.log("No items with dates found.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const label = filter ? `Timeline — ${filter}` : "Timeline";
  console.log(`\n  Pulse — ${label}  (${dated.length} items with dates)\n`);

  const allStarts = dated.map((i) => new Date(i["start date"]).getTime());
  const allEnds = dated.map((i) => new Date(i["target date"]).getTime());
  const minTime = Math.min(...allStarts);
  const maxTime = Math.max(...allEnds);
  const totalDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
  const barWidth = 60;

  const monthStart = new Date(minTime);
  monthStart.setDate(1);
  const monthMarkers: { pos: number; name: string }[] = [];
  while (monthStart <= new Date(maxTime)) {
    const dayOffset = (monthStart.getTime() - minTime) / (1000 * 60 * 60 * 24);
    const pos = Math.round((dayOffset / totalDays) * barWidth);
    if (pos >= 0 && pos < barWidth) {
      monthMarkers.push({ pos, name: months[monthStart.getMonth()] });
    }
    monthStart.setMonth(monthStart.getMonth() + 1);
  }
  let headerBar = " ".repeat(barWidth);
  for (const m of monthMarkers) {
    headerBar = headerBar.slice(0, m.pos) + m.name + headerBar.slice(m.pos + m.name.length);
  }
  console.log(`  ${headerBar}`);
  console.log(`  ${"─".repeat(barWidth)}`);

  for (const item of dated) {
    const { barStart, barLen, days } = calcBar(
      item["start date"], item["target date"], minTime, totalDays, barWidth
    );

    const color = priorityColor(item.priority);
    const reset = "\x1b[0m";
    const bar =
      " ".repeat(barStart) +
      color + "━".repeat(barLen) + reset +
      " ".repeat(Math.max(0, barWidth - barStart - barLen));

    const rangeLabel = fmtDateRange(item["start date"], item["target date"]);
    let dateLine = " ".repeat(barWidth + 20);
    const labelPos = Math.max(0, barStart);
    dateLine = dateLine.slice(0, labelPos) + rangeLabel + dateLine.slice(labelPos + rangeLabel.length);

    const pri = (item.priority || "-").padEnd(2);
    const oracle = (item.oracle || "-").padEnd(10);
    const daysStr = `${days}d`.padStart(5);
    console.log(`  \x1b[90m${dateLine}\x1b[0m`);
    console.log(`  ${bar}  ${pri} ${oracle} ${daysStr}`);
    console.log(`  ${item.title.slice(0, 58)}`);
    console.log();
  }

  const todayOffset = (new Date(today).getTime() - minTime) / (1000 * 60 * 60 * 24);
  const todayPos = Math.round((todayOffset / totalDays) * barWidth);
  console.log(`  ${"─".repeat(barWidth)}`);
  console.log(" ".repeat(2 + todayPos - 2) + "today");
  console.log();
}
