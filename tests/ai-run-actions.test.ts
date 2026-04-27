import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as suggest } from "../src/app/api/ai/suggest/route";
import { POST as accept } from "../src/app/api/ai/runs/[id]/accept/route";
import { POST as refine } from "../src/app/api/ai/runs/[id]/refine/route";
import { POST as reject } from "../src/app/api/ai/runs/[id]/reject/route";
import {
  DEMO_USER,
  SESSION_COOKIE_NAME,
  getSessionCookieValue
} from "../src/lib/auth";
import { createStore } from "../src/lib/store";
import type { AiRun, Memory } from "../src/lib/types";

const tempRoots: string[] = [];
let previousDataFile: string | undefined;
let previousAiMode: string | undefined;

function authCookie() {
  return `${SESSION_COOKIE_NAME}=${getSessionCookieValue()}`;
}

function authedRequest(path: string, body: unknown = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: authCookie()
    },
    body: JSON.stringify(body)
  });
}

function authedMalformedRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: authCookie()
    },
    body: "{"
  });
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function frankDraft(overrides: Partial<Memory> = {}): Memory {
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
    updatedAt: now,
    ...overrides
  };
}

async function tempStoragePath() {
  const root = await mkdtemp(join(tmpdir(), "recallia-ai-actions-"));
  tempRoots.push(root);
  return join(root, "recallia.json");
}

async function createPendingRun() {
  const store = createStore();
  const draft = frankDraft();
  await store.upsertMemory(draft);
  await suggest(authedRequest("/api/ai/suggest", { memoryId: draft.id }));
  const [aiRun] = await store.listAiRuns(DEMO_USER.id, draft.id);

  return { store, draft, aiRun };
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

describe("AI run actions", () => {
  it("accept applies suggestions and marks the AiRun accepted", async () => {
    const { store, aiRun } = await createPendingRun();

    const response = await accept(
      authedRequest(`/api/ai/runs/${aiRun.id}/accept`, {}),
      routeContext(aiRun.id)
    );
    const body = (await response.json()) as { aiRun: AiRun; memory: Memory };

    expect(response.status).toBe(200);
    expect(body.aiRun.status).toBe("accepted");
    expect(body.memory).toMatchObject({
      status: "saved",
      startDate: "1995-01-01",
      endDate: "1999-12-31",
      dateConfidence: "approximate",
      linkedMemoryIds: [
        "memory-lived-in-frankfurt",
        "memory-owned-beige-vw-golf-1"
      ]
    });

    const [persistedRun] = await store.listAiRuns(DEMO_USER.id, aiRun.memoryId);
    const persistedMemory = (await store.listMemories(DEMO_USER.id)).find(
      (memory) => memory.id === aiRun.memoryId
    );
    expect(persistedRun.status).toBe("accepted");
    expect(persistedMemory?.startDate).toBe("1995-01-01");
    expect(persistedRun.inputSnapshot).toContain("Met Frank in Frankfurt");
    expect(persistedRun.existingMemorySnapshot).toContain("Owned beige VW Golf 1");
    expect(persistedRun.aiResponse).toContain("Which other facts were true");
    expect(persistedRun.adapterMode).toBe("mock");
    expect(persistedRun.createdAt).toBeTruthy();
  });

  it("refine updates the pending suggestion from selected overlapping memories", async () => {
    const { store, aiRun } = await createPendingRun();

    const response = await refine(
      authedRequest(`/api/ai/runs/${aiRun.id}/refine`, {
        linkedMemoryIds: [
          "memory-lived-in-frankfurt",
          "memory-owned-beige-vw-golf-1",
          "memory-attended-evening-school",
          "memory-worked-logistics-warehouse"
        ]
      }),
      routeContext(aiRun.id)
    );
    const body = (await response.json()) as { aiRun: AiRun };

    expect(response.status).toBe(200);
    expect(body.aiRun).toMatchObject({
      status: "pending",
      suggestedStartDate: "1997-01-01",
      suggestedEndDate: "1998-12-31",
      suggestedLinkedMemoryIds: [
        "memory-lived-in-frankfurt",
        "memory-owned-beige-vw-golf-1",
        "memory-attended-evening-school",
        "memory-worked-logistics-warehouse"
      ]
    });

    const [persistedRun] = await store.listAiRuns(DEMO_USER.id, aiRun.memoryId);
    const persistedMemory = (await store.listMemories(DEMO_USER.id)).find(
      (memory) => memory.id === aiRun.memoryId
    );
    expect(persistedRun.suggestedStartDate).toBe("1997-01-01");
    expect(persistedRun.aiResponse).toContain("Worked at logistics warehouse");
    expect(persistedMemory?.startDate).toBeUndefined();
  });

  it("refine rejects selected memories that do not overlap", async () => {
    const { aiRun } = await createPendingRun();

    const response = await refine(
      authedRequest(`/api/ai/runs/${aiRun.id}/refine`, {
        linkedMemoryIds: [
          "memory-lived-in-frankfurt",
          "memory-owned-silver-bmw-3-series"
        ]
      }),
      routeContext(aiRun.id)
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Those selected memories do not overlap in time.");
  });

  it("reject marks the AiRun rejected without applying suggestions", async () => {
    const { store, aiRun } = await createPendingRun();

    const response = await reject(
      authedRequest(`/api/ai/runs/${aiRun.id}/reject`, {}),
      routeContext(aiRun.id)
    );
    const body = (await response.json()) as { aiRun: AiRun };

    expect(response.status).toBe(200);
    expect(body.aiRun.status).toBe("rejected");

    const [persistedRun] = await store.listAiRuns(DEMO_USER.id, aiRun.memoryId);
    const persistedMemory = (await store.listMemories(DEMO_USER.id)).find(
      (memory) => memory.id === aiRun.memoryId
    );
    expect(persistedRun.status).toBe("rejected");
    expect(persistedMemory?.startDate).toBeUndefined();
    expect(persistedMemory?.linkedMemoryIds).toEqual([]);
    expect(persistedMemory?.status).toBe("draft");
  });

  it("accept rejects malformed JSON without applying suggestions", async () => {
    const { store, aiRun } = await createPendingRun();

    const response = await accept(
      authedMalformedRequest(`/api/ai/runs/${aiRun.id}/accept`),
      routeContext(aiRun.id)
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body.");

    const [persistedRun] = await store.listAiRuns(DEMO_USER.id, aiRun.memoryId);
    const persistedMemory = (await store.listMemories(DEMO_USER.id)).find(
      (memory) => memory.id === aiRun.memoryId
    );
    expect(persistedRun.status).toBe("pending");
    expect(persistedMemory?.startDate).toBeUndefined();
    expect(persistedMemory?.linkedMemoryIds).toEqual([]);
  });

  it("edit applies manual values and marks accepted_with_edits", async () => {
    const { store, aiRun } = await createPendingRun();

    const response = await accept(
      authedRequest(`/api/ai/runs/${aiRun.id}/accept`, {
        edits: {
          startDate: "1997-01-01",
          endDate: "1998-12-31",
          dateConfidence: "approximate",
          linkedMemoryIds: ["memory-lived-in-frankfurt"]
        }
      }),
      routeContext(aiRun.id)
    );
    const body = (await response.json()) as { aiRun: AiRun; memory: Memory };

    expect(response.status).toBe(200);
    expect(body.aiRun.status).toBe("accepted_with_edits");
    expect(body.memory).toMatchObject({
      status: "saved",
      startDate: "1997-01-01",
      endDate: "1998-12-31",
      linkedMemoryIds: ["memory-lived-in-frankfurt"]
    });

    const [persistedRun] = await store.listAiRuns(DEMO_USER.id, aiRun.memoryId);
    const persistedMemory = (await store.listMemories(DEMO_USER.id)).find(
      (memory) => memory.id === aiRun.memoryId
    );
    expect(persistedRun.status).toBe("accepted_with_edits");
    expect(persistedMemory?.startDate).toBe("1997-01-01");
    expect(persistedMemory?.linkedMemoryIds).toEqual(["memory-lived-in-frankfurt"]);
  });
});
