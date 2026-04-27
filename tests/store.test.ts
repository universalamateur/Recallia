import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_USER } from "../src/lib/auth";
import { createSeedData } from "../src/lib/seed";
import { createStore } from "../src/lib/store";
import type { AiRun, Memory } from "../src/lib/types";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

async function tempStoragePath() {
  const root = await mkdtemp(join(tmpdir(), "recallia-store-"));
  tempRoots.push(root);
  return join(root, "nested", "recallia.json");
}

function testMemory(overrides: Partial<Memory> = {}): Memory {
  const now = "2026-04-27T12:00:00.000Z";

  return {
    id: "memory-test-draft",
    userId: DEMO_USER.id,
    status: "draft",
    title: "Met Frank in Frankfurt",
    description:
      "I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.",
    dateConfidence: "unknown",
    people: ["Frank"],
    tags: ["friend", "Frankfurt"],
    linkedMemoryIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function testAiRun(overrides: Partial<AiRun> = {}): AiRun {
  return {
    id: "ai-run-test",
    userId: DEMO_USER.id,
    memoryId: "memory-test-draft",
    inputSnapshot: JSON.stringify({ title: "Met Frank in Frankfurt" }),
    existingMemorySnapshot: JSON.stringify({ memories: ["Lived in Frankfurt"] }),
    aiResponse: JSON.stringify({
      suggestedStartDate: "1997-01-01",
      suggestedEndDate: "1998-12-31"
    }),
    suggestedStartDate: "1997-01-01",
    suggestedEndDate: "1998-12-31",
    suggestedLinkedMemoryIds: [
      "memory-lived-in-frankfurt",
      "memory-owned-beige-vw-golf-1",
      "memory-attended-evening-school",
      "memory-worked-logistics-warehouse"
    ],
    clarifyingQuestion: "Do any other residence, car, work, or learning memories also fit?",
    adapterMode: "mock",
    status: "pending",
    createdAt: "2026-04-27T12:05:00.000Z",
    ...overrides
  };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("RecalliaStore", () => {
  it("creates deterministic seed data on first read", async () => {
    const storagePath = await tempStoragePath();
    const store = createStore({ storagePath });

    const data = await store.readData();

    expect(data.aiRuns).toEqual([]);
    expect(data.memories.map((memory) => memory.title)).toEqual(
      createSeedData().memories.map((memory) => memory.title)
    );
    expect(data.memories.every((memory) => memory.userId === DEMO_USER.id)).toBe(true);

    await expect(access(storagePath)).resolves.toBeUndefined();
  });

  it("handles concurrent first reads while creating seed data", async () => {
    const storagePath = await tempStoragePath();

    const reads = await Promise.all(
      Array.from({ length: 8 }, () => createStore({ storagePath }).readData())
    );

    expect(reads.every((data) => data.memories.length === createSeedData().memories.length)).toBe(
      true
    );
    expect(JSON.parse(await readFile(storagePath, "utf8")).memories).toHaveLength(
      createSeedData().memories.length
    );
  });

  it("backfills newly added seed memories without removing local drafts", async () => {
    const storagePath = await tempStoragePath();
    const oldSeedData = createSeedData();
    const newSeedMemory = oldSeedData.memories.at(-1);

    if (!newSeedMemory) {
      throw new Error("Expected seed data.");
    }

    await createStore({ storagePath }).writeData({
      memories: [...oldSeedData.memories.slice(0, -1), testMemory()],
      aiRuns: []
    });

    const memories = await createStore({ storagePath }).listMemories(DEMO_USER.id);

    expect(memories.map((memory) => memory.id)).toContain(newSeedMemory.id);
    expect(memories.map((memory) => memory.id)).toContain("memory-test-draft");
  });

  it("persists created memories across store instances without corrupting seed data", async () => {
    const storagePath = await tempStoragePath();
    const store = createStore({ storagePath });

    await store.upsertMemory(testMemory());

    const reloadedStore = createStore({ storagePath });
    const memories = await reloadedStore.listMemories(DEMO_USER.id);

    expect(memories).toHaveLength(createSeedData().memories.length + 1);
    expect(memories.some((memory) => memory.title === "Met Frank in Frankfurt")).toBe(true);
    expect(memories.some((memory) => memory.title === "Owned beige VW Golf 1")).toBe(true);

    const raw = await readFile(storagePath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("keeps test storage paths isolated", async () => {
    const firstPath = await tempStoragePath();
    const secondPath = await tempStoragePath();

    await createStore({ storagePath: firstPath }).upsertMemory(
      testMemory({ id: "memory-only-in-first" })
    );

    const firstMemories = await createStore({ storagePath: firstPath }).listMemories(
      DEMO_USER.id
    );
    const secondMemories = await createStore({ storagePath: secondPath }).listMemories(
      DEMO_USER.id
    );

    expect(firstMemories.map((memory) => memory.id)).toContain("memory-only-in-first");
    expect(secondMemories.map((memory) => memory.id)).not.toContain("memory-only-in-first");
  });

  it("persists AI runs across store instances for the expected user and memory", async () => {
    const storagePath = await tempStoragePath();
    const store = createStore({ storagePath });

    await store.upsertMemory(testMemory());
    await store.upsertAiRun(testAiRun());

    const reloadedStore = createStore({ storagePath });
    const aiRuns = await reloadedStore.listAiRuns(DEMO_USER.id, "memory-test-draft");

    expect(aiRuns).toEqual([testAiRun()]);
    expect(await reloadedStore.listAiRuns("other-user", "memory-test-draft")).toEqual([]);
    expect(await reloadedStore.listAiRuns(DEMO_USER.id, "other-memory")).toEqual([]);
  });

  it("resets a configured local runtime data file", async () => {
    const storagePath = await tempStoragePath();
    await createStore({ storagePath }).upsertMemory(testMemory());
    await expect(access(storagePath)).resolves.toBeUndefined();

    await execFileAsync(process.execPath, ["scripts/reset-data.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, RECALLIA_DATA_FILE: storagePath }
    });

    await expect(access(storagePath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
