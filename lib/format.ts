const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Format date as "4 Mar" */
export function fmtDate(dateStr: string): string {
  const dt = new Date(dateStr);
  return `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]}`;
}

/** Smart date range: same month = "4 → 31 Mar", different = "4 Feb → 30 Jun" */
export function fmtDateRange(startStr: string, endStr: string): string {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return sameMonth
    ? `${s.getDate()} → ${e.getDate()} ${MONTH_NAMES[e.getMonth()]}`
    : `${fmtDate(startStr)} → ${fmtDate(endStr)}`;
}

/** Format board dates column: "03-10 → 04-02" or "-" */
export function fmtBoardDates(start: string, target: string): string {
  if (start && target) return `${start.slice(5)} → ${target.slice(5)}`;
  if (start) return start.slice(5);
  return "-";
}

/** ANSI color code for priority */
export function priorityColor(priority: string): string {
  if (priority === "P0") return "\x1b[91m"; // red
  if (priority === "P1") return "\x1b[93m"; // yellow
  return "\x1b[90m"; // gray
}

/** Calculate bar position and length within a fixed width */
export function calcBar(
  startDate: string,
  endDate: string,
  minTime: number,
  totalDays: number,
  barWidth: number
): { barStart: number; barLen: number; days: number } {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const startOffset = (start - minTime) / (1000 * 60 * 60 * 24);
  const endOffset = (end - minTime) / (1000 * 60 * 60 * 24);
  const barStart = Math.round((startOffset / totalDays) * barWidth);
  const barEnd = Math.round((endOffset / totalDays) * barWidth);
  const barLen = Math.max(barEnd - barStart, 1);
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return { barStart, barLen, days };
}
