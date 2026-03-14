const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Estimate display width of a string.
 * Thai combining marks (0E31, 0E34-0E3A, 0E47-0E4E) are zero-width.
 * CJK/fullwidth chars are double-width. Everything else is 1.
 */
export function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    // Thai combining vowels & tone marks
    if (cp === 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E)) continue;
    // CJK / fullwidth
    if ((cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0xA4CF) ||
        (cp >= 0xAC00 && cp <= 0xD7AF) || (cp >= 0xF900 && cp <= 0xFAFF) ||
        (cp >= 0xFE10 && cp <= 0xFE6F) || (cp >= 0xFF01 && cp <= 0xFF60) ||
        (cp >= 0x20000 && cp <= 0x2FA1F)) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

/** Pad string to target display width */
export function padDisplay(str: string, width: number): string {
  const dw = displayWidth(str);
  return dw >= width ? str : str + " ".repeat(width - dw);
}

/** Slice string to fit within target display width */
export function sliceDisplay(str: string, maxWidth: number): string {
  let w = 0;
  let i = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    let cw = 1;
    if (cp === 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E)) cw = 0;
    else if ((cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0xA4CF) ||
        (cp >= 0xAC00 && cp <= 0xD7AF) || (cp >= 0xF900 && cp <= 0xFAFF) ||
        (cp >= 0xFE10 && cp <= 0xFE6F) || (cp >= 0xFF01 && cp <= 0xFF60) ||
        (cp >= 0x20000 && cp <= 0x2FA1F)) cw = 2;
    if (w + cw > maxWidth) break;
    w += cw;
    i += ch.length;
  }
  return str.slice(0, i);
}

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
