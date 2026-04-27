import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createMemory } from "../src/app/api/memories/route";
import { GET as getTimeline } from "../src/app/api/timeline/route";
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

function authCookie() {
  return `${SESSION_COOKIE_NAME}=${getSessionCookieValue()}`;
}

function authedJsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: authCookie()
    },
    body: JSON.stringify(body)
  });
}

function authedGetRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: authCookie() }
  });
}

async function tempStoragePath() {
  const root = await mkdtemp(join(tmpdir(), "recallia-route-"));
  tempRoots.push(root);
  return join(root, "recallia.json");
}

async function createDraft(body: Record<string, unknown>) {
  const response = await createMemory(authedJsonRequest("/api/memories", body));
  const json = (await response.json()) as { memory: Memory; intent: string };
  return { response, json };
}

beforeEach(async () => {
  previousDataFile = process.env.RECALLIA_DATA_FILE;
  process.env.RECALLIA_DATA_FILE = await tempStoragePath();
});

afterEach(async () => {
  if (previousDataFile === undefined) {
    delete process.env.RECALLIA_DATA_FILE;
  } else {
    process.env.RECALLIA_DATA_FILE = previousDataFile;
  }

  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("memory draft routes", () => {
  it("creates a persisted draft memory for the authenticated user", async () => {
    const { response, json } = await createDraft({
      intent: "save_draft",
      title: "Met Frank in Frankfurt",
      description:
        "I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.",
      dateConfidence: "unknown",
      location: "Frankfurt",
      people: "Frank",
      tags: "friend, Frankfurt"
    });

    expect(response.status).toBe(201);
    expect(json.intent).toBe("save_draft");
    expect(json.memory).toMatchObject({
      userId: DEMO_USER.id,
      status: "draft",
      title: "Met Frank in Frankfurt",
      dateConfidence: "unknown",
      people: ["Frank"],
      tags: ["friend", "Frankfurt"],
      linkedMemoryIds: []
    });

    const memories = await createStore().listMemories(DEMO_USER.id);
    expect(memories).toHaveLength(createSeedData().memories.length + 1);
    expect(memories.map((memory) => memory.title)).toContain("Owned beige VW Golf 1");
    expect(memories.map((memory) => memory.title)).toContain("Met Frank in Frankfurt");
  });

  it("reuses an existing persisted draft when Ask Recallia AI is clicked", async () => {
    const first = await createDraft({
      intent: "save_draft",
      title: "Met Frank in Frankfurt",
      description: "I met Frank in Frankfurt.",
      dateConfidence: "unknown",
      people: "Frank",
      tags: "friend"
    });

    const second = await createDraft({
      id: first.json.memory.id,
      intent: "ask_ai",
      title: "Met Frank in Frankfurt",
      description:
        "I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.",
      dateConfidence: "unknown",
      location: "Frankfurt",
      people: "Frank",
      tags: "friend, Frankfurt"
    });

    expect(second.response.status).toBe(200);
    expect(second.json.intent).toBe("ask_ai");
    expect(second.json.memory.id).toBe(first.json.memory.id);

    const memories = await createStore().listMemories(DEMO_USER.id);
    expect(memories).toHaveLength(createSeedData().memories.length + 1);
    expect(memories.filter((memory) => memory.title === "Met Frank in Frankfurt")).toHaveLength(1);
    expect(memories.find((memory) => memory.id === first.json.memory.id)?.tags).toEqual([
      "friend",
      "Frankfurt"
    ]);
  });

  it("returns the new draft in the authenticated timeline without dropping seeds", async () => {
    await createDraft({
      intent: "save_draft",
      title: "Met Frank in Frankfurt",
      description: "I met Frank in Frankfurt.",
      startDate: "",
      endDate: "",
      dateConfidence: "unknown",
      people: "Frank",
      tags: "friend"
    });

    const response = await getTimeline(authedGetRequest("/api/timeline"));
    const body = (await response.json()) as { memories: Memory[] };

    expect(response.status).toBe(200);
    expect(body.memories.map((memory) => memory.title)).toEqual([
      ...createSeedData().memories.map((memory) => memory.title),
      "Met Frank in Frankfurt"
    ]);
  });
});
