import { describe, expect, it } from "vitest";
import { DEMO_USER } from "../src/lib/auth";
import { selectActiveTimelineRun, visibleMemoriesForTimeline } from "../src/lib/timeline-active-run";
import type { AiRun, Memory } from "../src/lib/types";

const now = "2026-04-27T12:00:00.000Z";

function memory(overrides: Partial<Memory>): Memory {
  return {
    id: "memory-test",
    userId: DEMO_USER.id,
    status: "saved",
    title: "Memory",
    description: "Synthetic memory.",
    dateConfidence: "approximate",
    people: [],
    tags: [],
    linkedMemoryIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function aiRun(overrides: Partial<AiRun>): AiRun {
  return {
    id: "ai-run-test",
    userId: DEMO_USER.id,
    memoryId: "memory-draft",
    inputSnapshot: "{}",
    existingMemorySnapshot: "[]",
    aiResponse: "{}",
    suggestedStartDate: "1997-01-01",
    suggestedEndDate: "1998-12-31",
    suggestedLinkedMemoryIds: [],
    adapterMode: "mock",
    status: "pending",
    createdAt: now,
    ...overrides
  };
}

describe("timeline active AI run selection", () => {
  const saved = memory({ id: "memory-saved", status: "saved" });
  const draft = memory({ id: "memory-draft", status: "draft" });

  it("hides stale drafts and pending runs when no run query is active", () => {
    const activeRun = selectActiveTimelineRun({
      runId: undefined,
      aiRuns: [aiRun({})],
      memories: [saved, draft]
    });

    expect(activeRun).toBeUndefined();
    expect(visibleMemoriesForTimeline({ memories: [saved, draft], activeRun })).toEqual([saved]);
  });

  it("shows a pending draft only when its run id is explicitly active", () => {
    const pendingRun = aiRun({ id: "ai-run-active" });
    const activeRun = selectActiveTimelineRun({
      runId: pendingRun.id,
      aiRuns: [pendingRun],
      memories: [saved, draft]
    });

    expect(activeRun?.aiRun.id).toBe(pendingRun.id);
    expect(visibleMemoriesForTimeline({ memories: [saved, draft], activeRun })).toEqual([
      saved,
      draft
    ]);
  });

  it("ignores accepted, rejected, unknown, and orphaned run ids", () => {
    const memories = [saved, draft];

    for (const run of [
      aiRun({ id: "accepted-run", status: "accepted" }),
      aiRun({ id: "rejected-run", status: "rejected" }),
      aiRun({ id: "orphaned-run", memoryId: "missing-memory" })
    ]) {
      const activeRun = selectActiveTimelineRun({
        runId: run.id,
        aiRuns: [run],
        memories
      });

      expect(activeRun).toBeUndefined();
      expect(visibleMemoriesForTimeline({ memories, activeRun })).toEqual([saved]);
    }

    expect(
      selectActiveTimelineRun({
        runId: "unknown-run",
        aiRuns: [aiRun({})],
        memories
      })
    ).toBeUndefined();
  });
});
