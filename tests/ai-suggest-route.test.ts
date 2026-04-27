import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as suggest } from "../src/app/api/ai/suggest/route";
import {
  DEMO_USER,
  SESSION_COOKIE_NAME,
  getSessionCookieValue
} from "../src/lib/auth";
import { createSeedData } from "../src/lib/seed";
import { createStore } from "../src/lib/store";
import type { Memory } from "../src/lib/types";

const tempRoots: string[] = [];
let previousDataFile: string | undefined;
let previousAiMode: string | undefined;

function authCookie() {
  return `${SESSION_COOKIE_NAME}=${getSessionCookieValue()}`;
}

function authedSuggestRequest(body: unknown) {
  return new Request("http://localhost/api/ai/suggest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: authCookie()
    },
    body: JSON.stringify(body)
  });
}

function unauthSuggestRequest(body: unknown) {
  return new Request("http://localhost/api/ai/suggest", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function frankDraft(): Memory {
  const now = "2026-04-27T12:00:00.000Z";

  return {
    id: "memory-frank-draft",
    userId: DEMO_USER.id,
    status: "draft",
    title: "Met Frank in Frankfurt",
    description:
      "I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.",
    dateConfidence: "unknown",
    location: "Frankfurt",
    people: ["Frank"],
    tags: ["friend", "Frankfurt"],
    linkedMemoryIds: [],
    createdAt: now,
    updatedAt: now
  };
}

async function tempStoragePath() {
  const root = await mkdtemp(join(tmpdir(), "recallia-ai-route-"));
  tempRoots.push(root);
  return join(root, "recallia.json");
}

beforeEach(async () => {
  previousDataFile = process.env.RECALLIA_DATA_FILE;
  previousAiMode = process.env.RECALLIA_AI_MODE;
  process.env.RECALLIA_DATA_FILE = await tempStoragePath();
  process.env.RECALLIA_AI_MODE = "mock";
});

afterEach(async () => {
  if (previousDataFile === undefined) {
    delete process.env.RECALLIA_DATA_FILE;
  } else {
    process.env.RECALLIA_DATA_FILE = previousDataFile;
  }

  if (previousAiMode === undefined) {
    delete process.env.RECALLIA_AI_MODE;
  } else {
    process.env.RECALLIA_AI_MODE = previousAiMode;
  }

  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("POST /api/ai/suggest", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await suggest(unauthSuggestRequest({ memoryId: "memory-frank-draft" }));

    expect(response.status).toBe(401);
  });

  it("persists a pending mock AiRun without mutating the draft memory", async () => {
    const store = createStore();
    const draft = frankDraft();
    await store.upsertMemory(draft);

    const response = await suggest(authedSuggestRequest({ memoryId: draft.id }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.adapterMode).toBe("mock");
    expect(body.validationWarnings).toEqual([]);
    expect(body.suggestion).toMatchObject({
      suggestedStartDate: "1995-01-01",
      suggestedEndDate: "1999-12-31",
      dateConfidence: "approximate"
    });
    expect(body.suggestion.suggestedLinkedMemoryIds).toEqual([
      "memory-lived-in-frankfurt",
      "memory-owned-beige-vw-golf-1"
    ]);

    const aiRuns = await store.listAiRuns(DEMO_USER.id, draft.id);
    expect(aiRuns).toHaveLength(1);
    expect(aiRuns[0]).toMatchObject({
      memoryId: draft.id,
      adapterMode: "mock",
      status: "pending",
      suggestedStartDate: "1995-01-01",
      suggestedEndDate: "1999-12-31",
      suggestedLinkedMemoryIds: [
        "memory-lived-in-frankfurt",
        "memory-owned-beige-vw-golf-1"
      ]
    });
    expect(aiRuns[0].inputSnapshot).toContain("Met Frank in Frankfurt");
    expect(aiRuns[0].existingMemorySnapshot).toContain("Owned beige VW Golf 1");

    const memories = await store.listMemories(DEMO_USER.id);
    const reloadedDraft = memories.find((memory) => memory.id === draft.id);
    expect(reloadedDraft?.startDate).toBeUndefined();
    expect(reloadedDraft?.endDate).toBeUndefined();
    expect(reloadedDraft?.linkedMemoryIds).toEqual([]);
    expect(memories.map((memory) => memory.title)).toEqual([
      ...createSeedData().memories.map((memory) => memory.title),
      "Met Frank in Frankfurt"
    ]);
  });

  it("returns 404 for a memory outside the authenticated user's scoped data", async () => {
    const response = await suggest(authedSuggestRequest({ memoryId: "unknown-memory" }));

    expect(response.status).toBe(404);
  });
});
