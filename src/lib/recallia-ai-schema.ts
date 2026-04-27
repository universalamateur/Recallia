import { z } from "zod";
import type { Memory, MemoryPlacementSuggestion } from "@/lib/types";

const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MemoryPlacementSuggestionWireSchema = z
  .object({
    suggestedStartDate: ISODateSchema.nullable().optional(),
    suggestedEndDate: ISODateSchema.nullable().optional(),
    dateConfidence: z.enum(["exact", "approximate", "unknown"]),
    suggestedLinkedMemoryIds: z.array(z.string()),
    reasoning: z.string().trim().min(1),
    clarifyingQuestion: z.string().trim().nullable().optional()
  })
  .strict();

export type MemoryPlacementSuggestionWire = z.infer<
  typeof MemoryPlacementSuggestionWireSchema
>;

export class AiSuggestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSuggestionValidationError";
  }
}

export function normalizeSuggestion(
  suggestion: MemoryPlacementSuggestionWire
): MemoryPlacementSuggestion {
  return {
    suggestedStartDate: suggestion.suggestedStartDate ?? undefined,
    suggestedEndDate: suggestion.suggestedEndDate ?? undefined,
    dateConfidence: suggestion.dateConfidence,
    suggestedLinkedMemoryIds: suggestion.suggestedLinkedMemoryIds,
    reasoning: suggestion.reasoning,
    clarifyingQuestion: suggestion.clarifyingQuestion ?? undefined
  };
}

export function parseMemoryPlacementSuggestion(value: unknown) {
  const parsed = MemoryPlacementSuggestionWireSchema.safeParse(value);

  if (!parsed.success) {
    throw new AiSuggestionValidationError("AI suggestion did not match the expected schema.");
  }

  return normalizeSuggestion(parsed.data);
}

export function parseMemoryPlacementSuggestionJson(value: string) {
  try {
    return parseMemoryPlacementSuggestion(JSON.parse(value));
  } catch (error) {
    if (error instanceof AiSuggestionValidationError) {
      throw error;
    }

    throw new AiSuggestionValidationError("AI suggestion response was not valid JSON.");
  }
}

export function validateSuggestionLinkedMemoryIds(input: {
  suggestion: MemoryPlacementSuggestion;
  existingMemories: Memory[];
}) {
  const allowedIds = new Set(input.existingMemories.map((memory) => memory.id));
  const suggestedLinkedMemoryIds = input.suggestion.suggestedLinkedMemoryIds.filter((id) =>
    allowedIds.has(id)
  );
  const ignoredLinkedMemoryIds = input.suggestion.suggestedLinkedMemoryIds.filter(
    (id) => !allowedIds.has(id)
  );

  return {
    suggestion: {
      ...input.suggestion,
      suggestedLinkedMemoryIds
    },
    ignoredLinkedMemoryIds
  };
}
