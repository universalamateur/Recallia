import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { RecalliaAiAdapter, RecalliaAiInput } from "@/lib/recallia-ai";
import {
  MemoryPlacementSuggestionWireSchema,
  normalizeSuggestion
} from "@/lib/recallia-ai-schema";
import {
  createAiInputSnapshot,
  createExistingMemorySnapshot,
  RECALLIA_AI_SYSTEM_PROMPT
} from "@/lib/recallia-ai-prompt";
import type { MemoryPlacementSuggestion } from "@/lib/types";

export class OpenAIRecalliaAiAdapter implements RecalliaAiAdapter {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(input: { client?: OpenAI; model?: string; timeoutMs?: number } = {}) {
    this.client = input.client ?? new OpenAI();
    this.model = input.model ?? process.env.RECALLIA_OPENAI_MODEL ?? "gpt-5.5";
    this.timeoutMs = input.timeoutMs ?? 5000;
  }

  async suggestMemoryPlacement(input: RecalliaAiInput): Promise<MemoryPlacementSuggestion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.client.responses.parse(
        {
          model: this.model,
          input: [
            {
              role: "system",
              content: RECALLIA_AI_SYSTEM_PROMPT
            },
            {
              role: "user",
              content: `Draft memory:\n${createAiInputSnapshot(input.draftMemory)}\n\nExisting memories:\n${createExistingMemorySnapshot(input.existingMemories)}`
            }
          ],
          text: {
            format: zodTextFormat(
              MemoryPlacementSuggestionWireSchema,
              "memory_placement_suggestion"
            )
          },
          store: false
        },
        { signal: controller.signal }
      );

      if (!response.output_parsed) {
        throw new Error("OpenAI response did not include parsed structured output.");
      }

      return normalizeSuggestion(response.output_parsed);
    } finally {
      clearTimeout(timeout);
    }
  }
}
