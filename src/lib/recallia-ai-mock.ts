import "server-only";

import type { RecalliaAiAdapter, RecalliaAiInput } from "@/lib/recallia-ai";
import type { MemoryPlacementSuggestion } from "@/lib/types";

const SPEC_LINK_ORDER = [
  "memory-lived-in-frankfurt",
  "memory-owned-beige-vw-golf-1"
];

export class MockRecalliaAiAdapter implements RecalliaAiAdapter {
  async suggestMemoryPlacement(input: RecalliaAiInput): Promise<MemoryPlacementSuggestion> {
    const hasDraftText = Boolean(
      `${input.draftMemory.title ?? ""} ${input.draftMemory.description ?? ""}`.trim()
    );

    if (!hasDraftText) {
      return {
        dateConfidence: "unknown",
        suggestedLinkedMemoryIds: [],
        reasoning: "Add a memory title or description before asking for placement help.",
        clarifyingQuestion: "What do you remember about this memory?"
      };
    }

    const existingIds = new Set(input.existingMemories.map((memory) => memory.id));

    return {
      suggestedStartDate: "1995-01-01",
      suggestedEndDate: "1999-12-31",
      dateConfidence: "approximate",
      suggestedLinkedMemoryIds: SPEC_LINK_ORDER.filter((id) => existingIds.has(id)),
      reasoning:
        "The memory mentions Frank in Frankfurt and the beige Golf, so the first supported overlap is the Frankfurt residence plus the beige Golf.",
      clarifyingQuestion:
        "Which other facts were true then: were you in evening school, working logistics, or driving a different car?"
    };
  }
}
