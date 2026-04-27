import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createSeedData } from "@/lib/seed";
import type { AiRun, Memory, RecalliaData } from "@/lib/types";

export type StoreOptions = {
  storagePath?: string;
};

export function getDefaultStoragePath() {
  return join(/*turbopackIgnore: true*/ process.cwd(), "data", "recallia.json");
}

function resolveStoragePath(storagePath?: string) {
  const configuredPath = storagePath ?? process.env.RECALLIA_DATA_FILE;

  if (!configuredPath) {
    return getDefaultStoragePath();
  }

  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(/*turbopackIgnore: true*/ process.cwd(), configuredPath);
}

function isMissingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseData(raw: string): RecalliaData {
  const parsed = JSON.parse(raw) as Partial<RecalliaData>;

  if (!Array.isArray(parsed.memories) || !Array.isArray(parsed.aiRuns)) {
    throw new Error("Recallia data file is malformed.");
  }

  return {
    memories: parsed.memories,
    aiRuns: parsed.aiRuns
  };
}

function addMissingSeedMemories(data: RecalliaData) {
  const seedData = createSeedData();
  const existingIds = new Set(data.memories.map((memory) => memory.id));
  const missingSeedMemories = seedData.memories.filter((memory) => !existingIds.has(memory.id));

  if (!missingSeedMemories.length) {
    return { data, changed: false };
  }

  return {
    data: {
      memories: [...data.memories, ...missingSeedMemories],
      aiRuns: data.aiRuns
    },
    changed: true
  };
}

export class RecalliaStore {
  readonly storagePath: string;

  constructor(options: StoreOptions = {}) {
    this.storagePath = resolveStoragePath(options.storagePath);
  }

  async readData(): Promise<RecalliaData> {
    try {
      const data = addMissingSeedMemories(parseData(await readFile(this.storagePath, "utf8")));

      if (data.changed) {
        await this.writeData(data.data);
      }

      return data.data;
    } catch (error) {
      if (!isMissingFile(error)) {
        throw error;
      }
    }

    const data = createSeedData();
    await this.writeData(data);
    return data;
  }

  async writeData(data: RecalliaData) {
    await mkdir(dirname(this.storagePath), { recursive: true });

    const temporaryPath = `${this.storagePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

    try {
      await rename(temporaryPath, this.storagePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async reset() {
    await rm(this.storagePath, { force: true });
  }

  async listMemories(userId: string) {
    const data = await this.readData();
    return data.memories.filter((memory) => memory.userId === userId);
  }

  async upsertMemory(memory: Memory) {
    const data = await this.readData();
    const existingIndex = data.memories.findIndex(
      (existing) => existing.id === memory.id && existing.userId === memory.userId
    );

    if (existingIndex === -1) {
      data.memories.push(memory);
    } else {
      data.memories[existingIndex] = memory;
    }

    await this.writeData(data);
    return memory;
  }

  async listAiRuns(userId: string, memoryId?: string) {
    const data = await this.readData();
    return data.aiRuns.filter(
      (run) => run.userId === userId && (!memoryId || run.memoryId === memoryId)
    );
  }

  async upsertAiRun(aiRun: AiRun) {
    const data = await this.readData();
    const existingIndex = data.aiRuns.findIndex(
      (existing) => existing.id === aiRun.id && existing.userId === aiRun.userId
    );

    if (existingIndex === -1) {
      data.aiRuns.push(aiRun);
    } else {
      data.aiRuns[existingIndex] = aiRun;
    }

    await this.writeData(data);
    return aiRun;
  }
}

export function createStore(options: StoreOptions = {}) {
  return new RecalliaStore(options);
}
