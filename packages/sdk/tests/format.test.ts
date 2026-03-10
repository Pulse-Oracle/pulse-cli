import { describe, expect, test } from "bun:test";
import { fmtDate, fmtDateRange, fmtBoardDates, priorityColor, calcBar } from "../src/format";

describe("fmtDate", () => {
  test("formats date as day + month name", () => {
    expect(fmtDate("2026-03-04")).toBe("4 Mar");
  });

  test("handles single digit day", () => {
    expect(fmtDate("2026-01-01")).toBe("1 Jan");
  });

  test("handles double digit day", () => {
    expect(fmtDate("2026-06-30")).toBe("30 Jun");
  });

  test("handles December", () => {
    expect(fmtDate("2026-12-25")).toBe("25 Dec");
  });
});

describe("fmtDateRange", () => {
  test("same month shows month once", () => {
    expect(fmtDateRange("2026-03-04", "2026-03-31")).toBe("4 → 31 Mar");
  });

  test("different months shows both", () => {
    expect(fmtDateRange("2026-02-04", "2026-06-30")).toBe("4 Feb → 30 Jun");
  });

  test("same month different year shows both", () => {
    expect(fmtDateRange("2025-03-01", "2026-03-31")).toBe("1 Mar → 31 Mar");
  });

  test("adjacent months shows both", () => {
    expect(fmtDateRange("2026-03-10", "2026-04-02")).toBe("10 Mar → 2 Apr");
  });
});

describe("fmtBoardDates", () => {
  test("both dates returns range", () => {
    expect(fmtBoardDates("2026-03-10", "2026-04-02")).toBe("03-10 → 04-02");
  });

  test("only start date returns start", () => {
    expect(fmtBoardDates("2026-03-10", "")).toBe("03-10");
  });

  test("no dates returns dash", () => {
    expect(fmtBoardDates("", "")).toBe("-");
  });
});

describe("priorityColor", () => {
  test("P0 returns red", () => {
    expect(priorityColor("P0")).toBe("\x1b[91m");
  });

  test("P1 returns yellow", () => {
    expect(priorityColor("P1")).toBe("\x1b[93m");
  });

  test("P2 returns gray", () => {
    expect(priorityColor("P2")).toBe("\x1b[90m");
  });

  test("unknown returns gray", () => {
    expect(priorityColor("")).toBe("\x1b[90m");
  });
});

describe("calcBar", () => {
  test("full range bar fills entire width", () => {
    const result = calcBar("2026-03-01", "2026-06-30", new Date("2026-03-01").getTime(), 121, 60);
    expect(result.barStart).toBe(0);
    expect(result.barLen).toBe(60);
    expect(result.days).toBe(121);
  });

  test("half range bar is roughly half width", () => {
    const minTime = new Date("2026-01-01").getTime();
    const result = calcBar("2026-01-01", "2026-07-01", minTime, 365, 60);
    expect(result.barStart).toBe(0);
    expect(result.barLen).toBeGreaterThan(25);
    expect(result.barLen).toBeLessThan(35);
  });

  test("bar length is at least 1", () => {
    const minTime = new Date("2026-01-01").getTime();
    const result = calcBar("2026-06-15", "2026-06-15", minTime, 365, 60);
    expect(result.barLen).toBe(1);
  });
});
