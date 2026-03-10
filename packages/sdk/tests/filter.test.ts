import { describe, expect, test } from "bun:test";
import { filterItems, groupByPriority } from "../src/filter";
import type { ProjectItem } from "../src/types";

const mockItems: ProjectItem[] = [
  { id: "1", title: "Bitkub Training", status: "Todo", priority: "P0", client: "Bitkub", oracle: "Hermes", "start date": "", "target date": "" },
  { id: "2", title: "C40-BMA Platform", status: "In Progress", priority: "P0", client: "ARKKRA", oracle: "Volt", "start date": "", "target date": "" },
  { id: "3", title: "P004 Discord", status: "Todo", priority: "P1", client: "Internal", oracle: "Neo", "start date": "", "target date": "" },
  { id: "4", title: "P005 SCG Health", status: "Todo", priority: "P1", client: "SCG", oracle: "Pulse", "start date": "", "target date": "" },
  { id: "5", title: "P001 Arm Dogtag", status: "Todo", priority: "P2", client: "Internal", oracle: "Pulse", "start date": "", "target date": "" },
  { id: "6", title: "Homekeeper Infra", status: "Todo", priority: "", client: "Internal", oracle: "Homekeeper", "start date": "", "target date": "" },
];

describe("filterItems", () => {
  test("filter by oracle name", () => {
    const result = filterItems(mockItems, "Pulse");
    expect(result.length).toBe(2);
    expect(result.every(i => i.oracle === "Pulse")).toBe(true);
  });

  test("filter by oracle is case-insensitive", () => {
    const result = filterItems(mockItems, "pulse");
    expect(result.length).toBe(2);
  });

  test("filter by client", () => {
    const result = filterItems(mockItems, "Bitkub");
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Bitkub Training");
  });

  test("filter by priority", () => {
    const result = filterItems(mockItems, "P0");
    expect(result.length).toBe(2);
  });

  test("filter by status", () => {
    const result = filterItems(mockItems, "In Progress");
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("C40-BMA Platform");
  });

  test("no match returns empty", () => {
    const result = filterItems(mockItems, "NonExistent");
    expect(result.length).toBe(0);
  });
});

describe("groupByPriority", () => {
  test("groups into P0, P1, P2, no priority", () => {
    const [p0, p1, p2, noP] = groupByPriority(mockItems);
    expect(p0.length).toBe(2);
    expect(p1.length).toBe(2);
    expect(p2.length).toBe(1);
    expect(noP.length).toBe(1);
  });

  test("P0 group contains correct items", () => {
    const [p0] = groupByPriority(mockItems);
    expect(p0.map(i => i.title)).toContain("Bitkub Training");
    expect(p0.map(i => i.title)).toContain("C40-BMA Platform");
  });

  test("no priority group contains items without priority", () => {
    const [, , , noP] = groupByPriority(mockItems);
    expect(noP[0].title).toBe("Homekeeper Infra");
  });

  test("empty input returns empty groups", () => {
    const [p0, p1, p2, noP] = groupByPriority([]);
    expect(p0.length).toBe(0);
    expect(p1.length).toBe(0);
    expect(p2.length).toBe(0);
    expect(noP.length).toBe(0);
  });
});
