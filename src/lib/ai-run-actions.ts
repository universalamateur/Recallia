import { z } from "zod";
import type { AiRun, Memory } from "@/lib/types";

const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const AcceptEditsSchema = z
  .object({
    startDate: z.union([ISODateSchema, z.literal("")]).optional(),
    endDate: z.union([ISODateSchema, z.literal("")]).optional(),
    dateConfidence: z.enum(["exact", "approximate", "unknown"]).optional(),
    linkedMemoryIds: z.array(z.string()).optional()
  })
  .strict();

export const AcceptAiRunRequestSchema = z
  .object({
    edits: AcceptEditsSchema.optional()
  })
  .strict();

export type AcceptAiRunRequest = z.infer<typeof AcceptAiRunRequestSchema>;

function optionalDate(value?: string) {
  return value?.trim() ? value : undefined;
}

export function applyAiRunAcceptance(input: {
  aiRun: AiRun;
  memory: Memory;
  existingMemories: Memory[];
  request: AcceptAiRunRequest;
  now?: string;
}) {
  const allowedLinkedIds = new Set(input.existingMemories.map((memory) => memory.id));
  const edited = Boolean(input.request.edits);
  const requestedLinks =
    input.request.edits?.linkedMemoryIds ?? input.aiRun.suggestedLinkedMemoryIds;

  for (const linkedMemoryId of requestedLinks) {
    if (!allowedLinkedIds.has(linkedMemoryId)) {
      throw new Error(`Unknown linked memory id: ${linkedMemoryId}`);
    }
  }

  const startDate = edited
    ? optionalDate(input.request.edits?.startDate) ?? input.aiRun.suggestedStartDate
    : input.aiRun.suggestedStartDate;
  const endDate = edited
    ? optionalDate(input.request.edits?.endDate) ?? input.aiRun.suggestedEndDate
    : input.aiRun.suggestedEndDate;
  const dateConfidence =
    input.request.edits?.dateConfidence ??
    (startDate ? "approximate" : input.memory.dateConfidence);
  const now = input.now ?? new Date().toISOString();

  return {
    memory: {
      ...input.memory,
      status: "saved" as const,
      startDate,
      endDate,
      dateConfidence,
      linkedMemoryIds: requestedLinks,
      updatedAt: now
    },
    aiRun: {
      ...input.aiRun,
      status: edited ? ("accepted_with_edits" as const) : ("accepted" as const)
    }
  };
}
