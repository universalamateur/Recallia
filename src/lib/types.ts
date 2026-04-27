export type DateConfidence = "exact" | "approximate" | "unknown";
export type MemoryStatus = "draft" | "saved";
export type AdapterMode = "codex" | "mock";
export type AiRunStatus = "pending" | "accepted" | "accepted_with_edits" | "rejected";

export type Memory = {
  id: string;
  userId: string;
  status: MemoryStatus;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  dateConfidence: DateConfidence;
  location?: string;
  people: string[];
  tags: string[];
  linkedMemoryIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AiRun = {
  id: string;
  userId: string;
  memoryId: string;
  inputSnapshot: string;
  existingMemorySnapshot: string;
  aiResponse: string;
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  suggestedLinkedMemoryIds: string[];
  clarifyingQuestion?: string;
  adapterMode: AdapterMode;
  status: AiRunStatus;
  createdAt: string;
};

export type MemoryPlacementSuggestion = {
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  dateConfidence: DateConfidence;
  suggestedLinkedMemoryIds: string[];
  reasoning: string;
  clarifyingQuestion?: string;
};

export type RecalliaData = {
  memories: Memory[];
  aiRuns: AiRun[];
};
