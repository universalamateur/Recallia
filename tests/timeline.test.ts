import { describe, expect, it } from "vitest";
import { formatDateRange, sortMemoriesForTimeline } from "../src/lib/timeline";
import type { Memory } from "../src/lib/types";

function memory(overrides: Partial<Memory>): Memory {
  return {
    id: "memory-default",
    userId: "demo-user",
    status: "saved",
    title: "Default memory",
    description: "A memory.",
    dateConfidence: "unknown",
    people: [],
    tags: [],
    linkedMemoryIds: [],
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    ...overrides
  };
}

describe("timeline helpers", () => {
  it("sorts dated memories first by start date and missing dates last", () => {
    const sorted = sortMemoriesForTimeline([
      memory({ id: "undated", title: "Undated" }),
      memory({ id: "range", title: "Range", startDate: "1996-01-01", endDate: "1999-12-31" }),
      memory({ id: "earliest", title: "Earliest", startDate: "1992-01-01" })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["earliest", "range", "undated"]);
  });

  it("sorts same-start-date memories by createdAt", () => {
    const sorted = sortMemoriesForTimeline([
      memory({
        id: "newer",
        title: "Newer",
        startDate: "1996-01-01",
        createdAt: "2026-04-27T12:00:00.000Z"
      }),
      memory({
        id: "older",
        title: "Older",
        startDate: "1996-01-01",
        createdAt: "2026-04-27T10:00:00.000Z"
      })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["older", "newer"]);
  });

  it("formats unknown dates, single dates, and year ranges", () => {
    expect(formatDateRange(memory({ startDate: undefined }))).toBe("Date unknown");
    expect(formatDateRange(memory({ startDate: "1996-04-12" }))).toBe("1996-04-12");
    expect(
      formatDateRange(memory({ startDate: "1996-01-01", endDate: "1999-12-31" }))
    ).toBe("1996-1999");
  });
});
