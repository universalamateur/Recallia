import type { AiRun } from "@/lib/types";
import { formatDateRange } from "@/lib/timeline";

export type AiRunView = {
  id: string;
  memoryId: string;
  status: AiRun["status"];
  adapterMode: AiRun["adapterMode"];
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  suggestedDateRange: string;
  suggestedLinkedMemoryIds: string[];
  suggestedLinkedMemories: Array<{ id: string; title: string }>;
  clarifyingQuestion?: string;
  reasoning: string;
  inputSnapshot: string;
  existingMemorySnapshot: string;
  aiResponse: string;
  fallbackReason?: string;
  validationWarnings: string[];
  createdAt: string;
};

function parseAiResponse(aiResponse: string) {
  try {
    return JSON.parse(aiResponse) as {
      suggestion?: {
        reasoning?: string;
      };
      fallbackReason?: string;
      validationWarnings?: string[];
    };
  } catch {
    return {};
  }
}

export function createAiRunView(input: {
  aiRun: AiRun;
  memoryTitleById: Map<string, string>;
}): AiRunView {
  const parsed = parseAiResponse(input.aiRun.aiResponse);

  return {
    id: input.aiRun.id,
    memoryId: input.aiRun.memoryId,
    status: input.aiRun.status,
    adapterMode: input.aiRun.adapterMode,
    suggestedStartDate: input.aiRun.suggestedStartDate,
    suggestedEndDate: input.aiRun.suggestedEndDate,
    suggestedDateRange: formatDateRange({
      startDate: input.aiRun.suggestedStartDate,
      endDate: input.aiRun.suggestedEndDate
    }),
    suggestedLinkedMemoryIds: input.aiRun.suggestedLinkedMemoryIds,
    suggestedLinkedMemories: input.aiRun.suggestedLinkedMemoryIds.map((id) => ({
      id,
      title: input.memoryTitleById.get(id) ?? id
    })),
    clarifyingQuestion: input.aiRun.clarifyingQuestion,
    reasoning: parsed.suggestion?.reasoning ?? "No reasoning was recorded.",
    inputSnapshot: input.aiRun.inputSnapshot,
    existingMemorySnapshot: input.aiRun.existingMemorySnapshot,
    aiResponse: input.aiRun.aiResponse,
    fallbackReason: parsed.fallbackReason,
    validationWarnings: parsed.validationWarnings ?? [],
    createdAt: input.aiRun.createdAt
  };
}

export function latestAiRun(aiRuns: AiRun[]) {
  return [...aiRuns].sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
}
