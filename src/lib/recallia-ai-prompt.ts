import type { Memory } from "@/lib/types";

export const RECALLIA_AI_SYSTEM_PROMPT = `You are Recallia AI, a memory timeline assistant.
Your job is to help place a new personal memory into a timeline by comparing it with existing memories.

Rules:
- Do not invent facts.
- Use only the provided draft memory and existing memories.
- Suggest date ranges only when supported by overlaps.
- Ask about likely residence, car, work, or learning memories when several overlaps are possible.
- Prefer asking a clarifying question when uncertain.
- Return structured JSON only.`;

function memorySummary(memory: Memory) {
  return {
    id: memory.id,
    title: memory.title,
    startDate: memory.startDate,
    endDate: memory.endDate,
    dateConfidence: memory.dateConfidence,
    location: memory.location,
    tags: memory.tags
  };
}

export function createAiInputSnapshot(draftMemory: Partial<Memory>) {
  return JSON.stringify(
    {
      id: draftMemory.id,
      title: draftMemory.title,
      description: draftMemory.description,
      startDate: draftMemory.startDate,
      endDate: draftMemory.endDate,
      dateConfidence: draftMemory.dateConfidence,
      location: draftMemory.location,
      people: draftMemory.people,
      tags: draftMemory.tags
    },
    null,
    2
  );
}

export function createExistingMemorySnapshot(existingMemories: Memory[]) {
  return JSON.stringify(existingMemories.map(memorySummary), null, 2);
}
