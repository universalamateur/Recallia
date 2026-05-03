import "server-only";

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Codex } from "@openai/codex-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { RecalliaAiAdapter, RecalliaAiInput } from "@/lib/recallia-ai";
import {
  MemoryPlacementSuggestionWireSchema,
  parseMemoryPlacementSuggestionJson
} from "@/lib/recallia-ai-schema";
import {
  createAiInputSnapshot,
  createExistingMemorySnapshot,
  RECALLIA_AI_SYSTEM_PROMPT
} from "@/lib/recallia-ai-prompt";
import type { MemoryPlacementSuggestion } from "@/lib/types";

const RECALLIA_OUTPUT_SCHEMA = zodToJsonSchema(
  MemoryPlacementSuggestionWireSchema,
  { target: "openAi" }
);
const PRIVATE_DIRECTORY_MODE = 0o700;
const DEFAULT_CODEX_WORKING_DIRECTORY = path.join(
  tmpdir(),
  "recallia-codex-scratch"
);

export class CodexSdkRecalliaAiAdapter implements RecalliaAiAdapter {
  private readonly codex: Codex;
  private readonly model?: string;
  private readonly timeoutMs: number;
  private readonly workingDirectory: string;

  constructor(input: {
    codex?: Codex;
    apiKey?: string;
    codexPathOverride?: string;
    model?: string;
    timeoutMs?: number;
    workingDirectory?: string;
  } = {}) {
    const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;

    this.model = input.model ?? process.env.RECALLIA_CODEX_MODEL;
    this.timeoutMs = input.timeoutMs ?? 60_000;
    this.workingDirectory = prepareCodexWorkingDirectory(
      input.workingDirectory ??
        process.env.RECALLIA_CODEX_WORKING_DIRECTORY ??
        DEFAULT_CODEX_WORKING_DIRECTORY
    );
    const codexPathOverride =
      input.codexPathOverride ??
      process.env.RECALLIA_CODEX_PATH ??
      resolveInstalledCodexBinaryPath();
    const codexProcessEnv = createCodexProcessEnv(this.workingDirectory);
    this.codex =
      input.codex ??
      new Codex({
        ...(apiKey ? { apiKey } : {}),
        ...(codexPathOverride ? { codexPathOverride } : {}),
        env: codexProcessEnv
      });
  }

  async suggestMemoryPlacement(
    input: RecalliaAiInput
  ): Promise<MemoryPlacementSuggestion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const thread = this.codex.startThread({
        ...(this.model ? { model: this.model } : {}),
        workingDirectory: this.workingDirectory,
        skipGitRepoCheck: true,
        sandboxMode: "read-only",
        approvalPolicy: "never",
        modelReasoningEffort: "medium",
        webSearchMode: "disabled"
      });
      const prompt = [
        RECALLIA_AI_SYSTEM_PROMPT,
        "",
        "Draft memory:",
        createAiInputSnapshot(input.draftMemory),
        "",
        "Existing memories:",
        createExistingMemorySnapshot(input.existingMemories)
      ].join("\n");

      const turn = await thread.run(prompt, {
        outputSchema: RECALLIA_OUTPUT_SCHEMA,
        signal: controller.signal
      });

      if (!turn.finalResponse) {
        throw new Error("Codex SDK returned no final assistant text.");
      }

      return parseMemoryPlacementSuggestionJson(turn.finalResponse);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function prepareCodexWorkingDirectory(candidate: string): string {
  const resolved = path.resolve(candidate);
  const repoRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  const dataRoot = path.resolve("data");

  rejectInsideDirectory({
    candidate: resolved,
    directory: dataRoot,
    message: "RECALLIA_CODEX_WORKING_DIRECTORY must not be inside runtime data."
  });
  rejectInsideDirectory({
    candidate: resolved,
    directory: repoRoot,
    message: "RECALLIA_CODEX_WORKING_DIRECTORY must not be inside the Recallia repo."
  });

  const realResolved = preparePrivateDirectory({
    directory: resolved,
    label: "RECALLIA_CODEX_WORKING_DIRECTORY"
  });
  const realRepoRoot = realPathIfExists(repoRoot);
  const realDataRoot = realPathIfExists(dataRoot);

  rejectInsideDirectory({
    candidate: realResolved,
    directory: realDataRoot,
    message: "RECALLIA_CODEX_WORKING_DIRECTORY must not be inside runtime data."
  });
  rejectInsideDirectory({
    candidate: realResolved,
    directory: realRepoRoot,
    message: "RECALLIA_CODEX_WORKING_DIRECTORY must not be inside the Recallia repo."
  });

  return realResolved;
}

function createCodexProcessEnv(workingDirectory: string): Record<string, string> {
  const homeDirectory = path.join(workingDirectory, "home");
  const codexHomeDirectory = path.join(workingDirectory, "codex-home");
  const tempDirectory = path.join(workingDirectory, "tmp");
  const env: Record<string, string> = {
    HOME: homeDirectory,
    USERPROFILE: homeDirectory,
    CODEX_HOME: codexHomeDirectory,
    TMPDIR: tempDirectory,
    TMP: tempDirectory,
    TEMP: tempDirectory
  };

  preparePrivateDirectory({
    directory: homeDirectory,
    label: "Codex scratch HOME"
  });
  preparePrivateDirectory({
    directory: codexHomeDirectory,
    label: "Codex scratch CODEX_HOME"
  });
  preparePrivateDirectory({
    directory: tempDirectory,
    label: "Codex scratch temp directory"
  });

  for (const key of ["PATH", "SystemRoot", "ComSpec", "WINDIR"]) {
    const value = process.env[key];

    if (value) {
      env[key] = value;
    }
  }

  return env;
}

function preparePrivateDirectory(input: {
  directory: string;
  label: string;
}) {
  if (existsSync(input.directory)) {
    const stat = lstatSync(input.directory);

    if (stat.isSymbolicLink()) {
      throw new Error(`${input.label} must not be a symbolic link.`);
    }

    if (!stat.isDirectory()) {
      throw new Error(`${input.label} must be a directory.`);
    }
  } else {
    mkdirSync(input.directory, {
      recursive: true,
      mode: PRIVATE_DIRECTORY_MODE
    });
  }

  chmodSync(input.directory, PRIVATE_DIRECTORY_MODE);
  return realpathSync.native(input.directory);
}

function rejectInsideDirectory(input: {
  candidate: string;
  directory: string;
  message: string;
}) {
  if (
    input.candidate === input.directory ||
    input.candidate.startsWith(`${input.directory}${path.sep}`)
  ) {
    throw new Error(input.message);
  }
}

function realPathIfExists(candidate: string) {
  return existsSync(candidate)
    ? realpathSync.native(candidate)
    : path.resolve(candidate);
}

function resolveInstalledCodexBinaryPath() {
  const targetTriple = targetTripleForCurrentPlatform();

  if (!targetTriple) {
    return undefined;
  }

  const platformPackage = platformPackageForTargetTriple(targetTriple);

  if (!platformPackage) {
    return undefined;
  }

  const binaryName = process.platform === "win32" ? "codex.exe" : "codex";
  const candidate = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    platformPackage,
    "vendor",
    targetTriple,
    "codex",
    binaryName
  );

  return existsSync(candidate) ? candidate : undefined;
}

function targetTripleForCurrentPlatform() {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "aarch64-apple-darwin";
  }

  if (process.platform === "darwin" && process.arch === "x64") {
    return "x86_64-apple-darwin";
  }

  if (
    (process.platform === "linux" || process.platform === "android") &&
    process.arch === "arm64"
  ) {
    return "aarch64-unknown-linux-musl";
  }

  if (
    (process.platform === "linux" || process.platform === "android") &&
    process.arch === "x64"
  ) {
    return "x86_64-unknown-linux-musl";
  }

  if (process.platform === "win32" && process.arch === "arm64") {
    return "aarch64-pc-windows-msvc";
  }

  if (process.platform === "win32" && process.arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }

  return undefined;
}

function platformPackageForTargetTriple(targetTriple: string) {
  const packageByTarget: Record<string, string> = {
    "aarch64-apple-darwin": "@openai/codex-darwin-arm64",
    "x86_64-apple-darwin": "@openai/codex-darwin-x64",
    "aarch64-unknown-linux-musl": "@openai/codex-linux-arm64",
    "x86_64-unknown-linux-musl": "@openai/codex-linux-x64",
    "aarch64-pc-windows-msvc": "@openai/codex-win32-arm64",
    "x86_64-pc-windows-msvc": "@openai/codex-win32-x64"
  };

  return packageByTarget[targetTriple];
}
