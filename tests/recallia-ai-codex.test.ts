import { mkdtemp, realpath, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecalliaAiRun } from "../src/lib/recallia-ai";
import { CodexSdkRecalliaAiAdapter } from "../src/lib/recallia-ai-codex";
import {
  AiSuggestionValidationError,
  MemoryPlacementSuggestionWireSchema
} from "../src/lib/recallia-ai-schema";
import { RECALLIA_AI_SYSTEM_PROMPT } from "../src/lib/recallia-ai-prompt";
import { createSeedData } from "../src/lib/seed";
import type { Memory, MemoryPlacementSuggestion } from "../src/lib/types";

const codexSdkMock = vi.hoisted(() => ({
  Codex: vi.fn(),
  run: vi.fn(),
  startThread: vi.fn()
}));

vi.mock("@openai/codex-sdk", () => ({
  Codex: codexSdkMock.Codex
}));

const validSuggestion: MemoryPlacementSuggestion = {
  suggestedStartDate: "1995-01-01",
  suggestedEndDate: "1999-12-31",
  dateConfidence: "approximate",
  suggestedLinkedMemoryIds: [
    "memory-lived-in-frankfurt",
    "memory-owned-beige-vw-golf-1"
  ],
  reasoning: "Supported by Frankfurt and beige Golf overlap.",
  clarifyingQuestion: "Which other memories were true then?"
};

const previousEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  RECALLIA_AI_MODE: process.env.RECALLIA_AI_MODE,
  RECALLIA_CODEX_MODEL: process.env.RECALLIA_CODEX_MODEL,
  RECALLIA_CODEX_WORKING_DIRECTORY:
    process.env.RECALLIA_CODEX_WORKING_DIRECTORY,
  RECALLIA_CODEX_PATH: process.env.RECALLIA_CODEX_PATH,
  RECALLIA_PRIVATE_TEST_SECRET: process.env.RECALLIA_PRIVATE_TEST_SECRET
};

const tempRoots: string[] = [];

function frankDraftMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: "memory-frank",
    userId: "user-demo",
    status: "draft",
    title: "Met Frank in Frankfurt",
    description:
      "I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.",
    dateConfidence: "unknown",
    location: "Frankfurt",
    people: ["Frank"],
    tags: ["friend", "Frankfurt"],
    linkedMemoryIds: [],
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    ...overrides
  };
}

async function makeWorkingDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "recallia-codex-test-"));
  tempRoots.push(directory);
  return directory;
}

async function directoryMode(directory: string) {
  return (await stat(directory)).mode & 0o777;
}

function resetEnv() {
  for (const key of Object.keys(previousEnv) as Array<keyof typeof previousEnv>) {
    const value = previousEnv[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("Codex SDK Recallia AI adapter", () => {
  beforeEach(() => {
    resetEnv();
    codexSdkMock.Codex.mockReset();
    codexSdkMock.run.mockReset();
    codexSdkMock.startThread.mockReset();
    codexSdkMock.run.mockResolvedValue({
      finalResponse: JSON.stringify(validSuggestion),
      items: [],
      usage: null
    });
    codexSdkMock.startThread.mockReturnValue({ run: codexSdkMock.run });
    codexSdkMock.Codex.mockImplementation(function MockCodex() {
      return {
        startThread: codexSdkMock.startThread
      };
    });
  });

  afterEach(async () => {
    resetEnv();

    while (tempRoots.length > 0) {
      const directory = tempRoots.pop();

      if (directory) {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });

  it("starts Codex in a locked-down scratch directory and runs with a schema", async () => {
    const workingDirectory = await makeWorkingDirectory();
    const realWorkingDirectory = await realpath(workingDirectory);
    process.env.OPENAI_API_KEY = "ambient-api-key";
    process.env.RECALLIA_PRIVATE_TEST_SECRET = "do-not-leak";
    const adapter = new CodexSdkRecalliaAiAdapter({
      apiKey: "test-api-key",
      model: "gpt-test",
      workingDirectory,
      timeoutMs: 1000
    });

    const suggestion = await adapter.suggestMemoryPlacement({
      draftMemory: frankDraftMemory(),
      existingMemories: createSeedData().memories
    });

    const codexOptions = codexSdkMock.Codex.mock.calls[0][0];
    const allowedEnvKeys = new Set([
      "CODEX_HOME",
      "ComSpec",
      "HOME",
      "PATH",
      "SystemRoot",
      "TEMP",
      "TMP",
      "TMPDIR",
      "USERPROFILE",
      "WINDIR"
    ]);

    expect(codexOptions).toEqual(
      expect.objectContaining({ apiKey: "test-api-key" })
    );
    expect(
      Object.keys(codexOptions.env).every((key) => allowedEnvKeys.has(key))
    ).toBe(true);
    expect(codexOptions.env).toEqual(
      expect.objectContaining({
        HOME: join(realWorkingDirectory, "home"),
        USERPROFILE: join(realWorkingDirectory, "home"),
        CODEX_HOME: join(realWorkingDirectory, "codex-home"),
        TMPDIR: join(realWorkingDirectory, "tmp"),
        TMP: join(realWorkingDirectory, "tmp"),
        TEMP: join(realWorkingDirectory, "tmp")
      })
    );
    expect(codexOptions.env.OPENAI_API_KEY).toBeUndefined();
    expect(codexOptions.env.RECALLIA_AI_MODE).toBeUndefined();
    expect(codexOptions.env.RECALLIA_PRIVATE_TEST_SECRET).toBeUndefined();
    await expect(directoryMode(realWorkingDirectory)).resolves.toBe(0o700);
    await expect(directoryMode(join(realWorkingDirectory, "home"))).resolves.toBe(
      0o700
    );
    await expect(
      directoryMode(join(realWorkingDirectory, "codex-home"))
    ).resolves.toBe(0o700);
    await expect(directoryMode(join(realWorkingDirectory, "tmp"))).resolves.toBe(
      0o700
    );
    expect(codexSdkMock.startThread).toHaveBeenCalledWith({
      model: "gpt-test",
      workingDirectory: realWorkingDirectory,
      skipGitRepoCheck: true,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      modelReasoningEffort: "medium",
      webSearchMode: "disabled"
    });

    const [prompt, options] = codexSdkMock.run.mock.calls[0];
    expect(prompt).toContain(RECALLIA_AI_SYSTEM_PROMPT);
    expect(prompt).toContain("Draft memory:");
    expect(prompt).toContain("Existing memories:");
    expect(prompt).toContain("Met Frank in Frankfurt");
    expect(options).toEqual({
      outputSchema: expect.objectContaining({
        type: "object",
        additionalProperties: false,
        $schema: expect.any(String)
      }),
      signal: expect.any(AbortSignal)
    });
    expect(suggestion).toEqual(validSuggestion);
  });

  it("uses the configured Codex binary path override", async () => {
    const workingDirectory = await makeWorkingDirectory();
    new CodexSdkRecalliaAiAdapter({
      codexPathOverride: "/custom/bin/codex",
      workingDirectory
    });

    expect(codexSdkMock.Codex).toHaveBeenCalledWith(
      expect.objectContaining({
        codexPathOverride: "/custom/bin/codex"
      })
    );
  });

  it("uses RECALLIA_CODEX_PATH when no constructor override is passed", async () => {
    const workingDirectory = await makeWorkingDirectory();
    process.env.RECALLIA_CODEX_PATH = "/env/bin/codex";
    new CodexSdkRecalliaAiAdapter({ workingDirectory });

    expect(codexSdkMock.Codex).toHaveBeenCalledWith(
      expect.objectContaining({
        codexPathOverride: "/env/bin/codex"
      })
    );
  });

  it("records codex mode only for successful configured SDK calls", async () => {
    const workingDirectory = await makeWorkingDirectory();
    process.env.RECALLIA_AI_MODE = "codex";
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.RECALLIA_CODEX_WORKING_DIRECTORY = workingDirectory;

    const result = await createRecalliaAiRun({
      userId: "user-demo",
      memoryId: "memory-frank",
      draftMemory: frankDraftMemory(),
      existingMemories: createSeedData().memories,
      now: "2026-04-27T00:00:00.000Z"
    });
    const aiResponse = JSON.parse(result.aiRun.aiResponse);

    expect(result.adapterMode).toBe("codex");
    expect(result.fallbackReason).toBeUndefined();
    expect(result.aiRun.adapterMode).toBe("codex");
    expect(aiResponse).toEqual(
      expect.objectContaining({
        adapterMode: "codex",
        validationWarnings: []
      })
    );
    expect(aiResponse.fallbackReason).toBeUndefined();
  });

  it("parses finalResponse through the existing suggestion schema gate", async () => {
    const workingDirectory = await makeWorkingDirectory();
    const adapter = new CodexSdkRecalliaAiAdapter({ workingDirectory });

    await expect(
      adapter.suggestMemoryPlacement({
        draftMemory: frankDraftMemory(),
        existingMemories: createSeedData().memories
      })
    ).resolves.toMatchObject({
      suggestedStartDate: "1995-01-01",
      suggestedEndDate: "1999-12-31"
    });
    expect(MemoryPlacementSuggestionWireSchema.safeParse(validSuggestion).success).toBe(
      true
    );
  });

  it("throws validation errors for malformed Codex JSON", async () => {
    const workingDirectory = await makeWorkingDirectory();
    codexSdkMock.run.mockResolvedValue({
      finalResponse: "{",
      items: [],
      usage: null
    });
    const adapter = new CodexSdkRecalliaAiAdapter({ workingDirectory });

    await expect(
      adapter.suggestMemoryPlacement({
        draftMemory: frankDraftMemory(),
        existingMemories: createSeedData().memories
      })
    ).rejects.toThrow(AiSuggestionValidationError);
  });

  it("propagates SDK failures so configured real mode can fall back to mock", async () => {
    const workingDirectory = await makeWorkingDirectory();
    codexSdkMock.run.mockRejectedValue(new Error("SDK unavailable"));
    process.env.RECALLIA_AI_MODE = "codex";
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.RECALLIA_CODEX_WORKING_DIRECTORY = workingDirectory;

    const result = await createRecalliaAiRun({
      userId: "user-demo",
      memoryId: "memory-frank",
      draftMemory: frankDraftMemory(),
      existingMemories: createSeedData().memories,
      now: "2026-04-27T00:00:00.000Z"
    });

    expect(result.adapterMode).toBe("mock");
    expect(result.fallbackReason).toBe("SDK unavailable");
    expect(result.aiRun.adapterMode).toBe("mock");
    expect(result.suggestion).toMatchObject({
      suggestedStartDate: "1995-01-01",
      suggestedEndDate: "1999-12-31"
    });
  });

  it("propagates timeouts from the SDK turn", async () => {
    const workingDirectory = await makeWorkingDirectory();
    codexSdkMock.run.mockImplementation(
      (_prompt: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new Error("Codex turn aborted"));
          });
        })
    );
    const adapter = new CodexSdkRecalliaAiAdapter({
      workingDirectory,
      timeoutMs: 1
    });

    await expect(
      adapter.suggestMemoryPlacement({
        draftMemory: frankDraftMemory(),
        existingMemories: createSeedData().memories
      })
    ).rejects.toThrow("Codex turn aborted");
  });

  it("rejects unsafe working directories inside the repo, runtime data, or symlinks", async () => {
    const workingDirectory = await makeWorkingDirectory();
    const linkDirectory = `${workingDirectory}-link`;
    tempRoots.push(linkDirectory);
    await symlink(workingDirectory, linkDirectory, "dir");

    expect(
      () =>
        new CodexSdkRecalliaAiAdapter({
          workingDirectory: process.cwd()
        })
    ).toThrow("must not be inside the Recallia repo");

    expect(
      () =>
        new CodexSdkRecalliaAiAdapter({
          workingDirectory: join(process.cwd(), "src", "tmp")
        })
    ).toThrow("must not be inside the Recallia repo");

    expect(
      () =>
        new CodexSdkRecalliaAiAdapter({
          workingDirectory: join(process.cwd(), "data", "codex")
        })
    ).toThrow("must not be inside runtime data");

    expect(
      () =>
        new CodexSdkRecalliaAiAdapter({
          workingDirectory: linkDirectory
        })
    ).toThrow("must not be a symbolic link");
  });
});
