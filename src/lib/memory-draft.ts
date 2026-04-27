import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Memory } from "@/lib/types";

const DateConfidenceSchema = z.enum(["exact", "approximate", "unknown"]);
const IntentSchema = z.enum(["save_draft", "ask_ai"]).default("save_draft");

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function listFromInput(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const DraftMemoryInputSchema = z
  .object({
    id: z.string().trim().optional(),
    intent: IntentSchema,
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    dateConfidence: DateConfidenceSchema.default("unknown"),
    location: z.string().trim().optional(),
    people: z.union([z.string(), z.array(z.string())]).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional()
  })
  .strict()
  .transform((input) => ({
    ...input,
    id: optionalText(input.id),
    startDate: optionalText(input.startDate),
    endDate: optionalText(input.endDate),
    location: optionalText(input.location),
    people: listFromInput(input.people),
    tags: listFromInput(input.tags)
  }));

export type DraftMemoryInput = z.infer<typeof DraftMemoryInputSchema>;

export function buildDraftMemory(input: {
  userId: string;
  draft: DraftMemoryInput;
  existingDraft?: Memory;
  now?: string;
}): Memory {
  const now = input.now ?? new Date().toISOString();

  return {
    id: input.existingDraft?.id ?? `memory-${randomUUID()}`,
    userId: input.userId,
    status: "draft",
    title: input.draft.title,
    description: input.draft.description,
    startDate: input.draft.startDate,
    endDate: input.draft.endDate,
    dateConfidence: input.draft.dateConfidence,
    location: input.draft.location,
    people: input.draft.people,
    tags: input.draft.tags,
    linkedMemoryIds: input.existingDraft?.linkedMemoryIds ?? [],
    createdAt: input.existingDraft?.createdAt ?? now,
    updatedAt: now
  };
}
