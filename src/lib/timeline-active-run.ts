import type { AiRun, Memory } from "@/lib/types";

export function selectActiveTimelineRun(input: {
  runId?: string;
  aiRuns: AiRun[];
  memories: Memory[];
}) {
  if (!input.runId) {
    return undefined;
  }

  const aiRun = input.aiRuns.find(
    (candidate) => candidate.id === input.runId && candidate.status === "pending"
  );

  if (!aiRun) {
    return undefined;
  }

  const memory = input.memories.find((candidate) => candidate.id === aiRun.memoryId);

  if (!memory) {
    return undefined;
  }

  return { aiRun, memory };
}

export function visibleMemoriesForTimeline(input: {
  memories: Memory[];
  activeRun?: { aiRun: AiRun; memory: Memory };
}) {
  return input.memories.filter(
    (memory) =>
      memory.status === "saved" ||
      (input.activeRun?.aiRun.status === "pending" &&
        memory.id === input.activeRun.aiRun.memoryId)
  );
}
