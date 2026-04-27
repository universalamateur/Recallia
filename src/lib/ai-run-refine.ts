import { z } from "zod";
import type { AiRun, Memory, MemoryPlacementSuggestion } from "@/lib/types";

export const RefineAiRunRequestSchema = z
  .object({
    linkedMemoryIds: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

export type RefineAiRunRequest = z.infer<typeof RefineAiRunRequestSchema>;

function latestDate(dates: string[]) {
  return dates.sort((first, second) => second.localeCompare(first))[0];
}

function earliestDate(dates: string[]) {
  return dates.sort((first, second) => first.localeCompare(second))[0];
}

function parseExistingResponse(aiResponse: string) {
  try {
    return JSON.parse(aiResponse) as {
      adapterMode?: AiRun["adapterMode"];
      fallbackReason?: string;
      validationWarnings?: string[];
    };
  } catch {
    return {};
  }
}

export function refineAiRunSuggestion(input: {
  aiRun: AiRun;
  existingMemories: Memory[];
  request: RefineAiRunRequest;
}) {
  if (input.aiRun.status !== "pending") {
    throw new Error("Only pending AI runs can be refined.");
  }

  const memoryById = new Map(input.existingMemories.map((memory) => [memory.id, memory]));
  const selectedMemories = input.request.linkedMemoryIds.map((id) => {
    const memory = memoryById.get(id);

    if (!memory) {
      throw new Error(`Unknown linked memory id: ${id}`);
    }

    return memory;
  });
  const datedMemories = selectedMemories.filter((memory) => memory.startDate && memory.endDate);

  if (datedMemories.length !== selectedMemories.length) {
    throw new Error("Selected memories need date ranges before Recallia can refine the time.");
  }

  const suggestedStartDate = latestDate(datedMemories.map((memory) => memory.startDate!));
  const suggestedEndDate = earliestDate(datedMemories.map((memory) => memory.endDate!));

  if (suggestedStartDate > suggestedEndDate) {
    throw new Error("Those selected memories do not overlap in time.");
  }

  const selectedTitles = selectedMemories.map((memory) => memory.title);
  const suggestion: MemoryPlacementSuggestion = {
    suggestedStartDate,
    suggestedEndDate,
    dateConfidence: "approximate",
    suggestedLinkedMemoryIds: input.request.linkedMemoryIds,
    reasoning: `The selected facts overlap only while ${selectedTitles.join(", ")} were all true.`,
    clarifyingQuestion:
      "Do any other residence, car, work, or learning memories also fit this moment?"
  };
  const previousResponse = parseExistingResponse(input.aiRun.aiResponse);

  return {
    ...input.aiRun,
    suggestedStartDate: suggestion.suggestedStartDate,
    suggestedEndDate: suggestion.suggestedEndDate,
    suggestedLinkedMemoryIds: suggestion.suggestedLinkedMemoryIds,
    clarifyingQuestion: suggestion.clarifyingQuestion,
    aiResponse: JSON.stringify(
      {
        suggestion,
        adapterMode: input.aiRun.adapterMode,
        fallbackReason: previousResponse.fallbackReason,
        validationWarnings: previousResponse.validationWarnings ?? [],
        refinement: {
          selectedMemoryIds: input.request.linkedMemoryIds,
          selectedTitles
        }
      },
      null,
      2
    )
  };
}
