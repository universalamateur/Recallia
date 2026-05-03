import "server-only";

import { randomUUID } from "node:crypto";
import type { AdapterMode, AiRun, Memory, MemoryPlacementSuggestion } from "@/lib/types";
import { validateSuggestionLinkedMemoryIds } from "@/lib/recallia-ai-schema";
import { MockRecalliaAiAdapter } from "@/lib/recallia-ai-mock";
import { CodexSdkRecalliaAiAdapter } from "@/lib/recallia-ai-codex";
import {
  createAiInputSnapshot,
  createExistingMemorySnapshot
} from "@/lib/recallia-ai-prompt";

export type RecalliaAiInput = {
  draftMemory: Partial<Memory>;
  existingMemories: Memory[];
};

export interface RecalliaAiAdapter {
  suggestMemoryPlacement(input: RecalliaAiInput): Promise<MemoryPlacementSuggestion>;
}

export type RecalliaAiRunResult = {
  aiRun: AiRun;
  suggestion: MemoryPlacementSuggestion;
  adapterMode: AdapterMode;
  validationWarnings: string[];
  fallbackReason?: string;
};

export function getConfiguredAdapterMode(env: NodeJS.ProcessEnv = process.env): AdapterMode {
  return env.RECALLIA_AI_MODE === "codex" && Boolean(env.OPENAI_API_KEY)
    ? "codex"
    : "mock";
}

async function runConfiguredAdapter(input: RecalliaAiInput) {
  const configuredMode = getConfiguredAdapterMode();

  if (configuredMode === "codex") {
    try {
      return {
        adapterMode: "codex" as const,
        suggestion: await new CodexSdkRecalliaAiAdapter().suggestMemoryPlacement(input)
      };
    } catch (error) {
      const fallbackReason =
        error instanceof Error ? error.message : "Codex SDK adapter failed.";

      return {
        adapterMode: "mock" as const,
        fallbackReason,
        suggestion: await new MockRecalliaAiAdapter().suggestMemoryPlacement(input)
      };
    }
  }

  return {
    adapterMode: "mock" as const,
    suggestion: await new MockRecalliaAiAdapter().suggestMemoryPlacement(input)
  };
}

export async function createRecalliaAiRun(input: {
  userId: string;
  memoryId: string;
  draftMemory: Memory;
  existingMemories: Memory[];
  now?: string;
}): Promise<RecalliaAiRunResult> {
  const inputSnapshot = createAiInputSnapshot(input.draftMemory);
  const existingMemorySnapshot = createExistingMemorySnapshot(input.existingMemories);
  const result = await runConfiguredAdapter({
    draftMemory: input.draftMemory,
    existingMemories: input.existingMemories
  });
  const validated = validateSuggestionLinkedMemoryIds({
    suggestion: result.suggestion,
    existingMemories: input.existingMemories
  });
  const validationWarnings = validated.ignoredLinkedMemoryIds.map(
    (id) => `Ignored unknown linked memory id: ${id}`
  );
  const aiResponse = JSON.stringify(
    {
      suggestion: validated.suggestion,
      adapterMode: result.adapterMode,
      fallbackReason: result.fallbackReason,
      validationWarnings
    },
    null,
    2
  );
  const aiRun: AiRun = {
    id: `ai-run-${randomUUID()}`,
    userId: input.userId,
    memoryId: input.memoryId,
    inputSnapshot,
    existingMemorySnapshot,
    aiResponse,
    suggestedStartDate: validated.suggestion.suggestedStartDate,
    suggestedEndDate: validated.suggestion.suggestedEndDate,
    suggestedLinkedMemoryIds: validated.suggestion.suggestedLinkedMemoryIds,
    clarifyingQuestion: validated.suggestion.clarifyingQuestion,
    adapterMode: result.adapterMode,
    status: "pending",
    createdAt: input.now ?? new Date().toISOString()
  };

  return {
    aiRun,
    suggestion: validated.suggestion,
    adapterMode: result.adapterMode,
    validationWarnings,
    fallbackReason: result.fallbackReason
  };
}
