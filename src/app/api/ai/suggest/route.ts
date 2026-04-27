import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { createRecalliaAiRun } from "@/lib/recallia-ai";
import { createStore } from "@/lib/store";

export const runtime = "nodejs";

const SuggestRequestSchema = z
  .object({
    memoryId: z.string().trim().min(1)
  })
  .strict();

export async function POST(request: Request) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SuggestRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI suggestion request." }, { status: 400 });
  }

  const store = createStore();
  const memories = await store.listMemories(user.id);
  const draftMemory = memories.find((memory) => memory.id === parsed.data.memoryId);

  if (!draftMemory) {
    return NextResponse.json({ error: "Memory not found." }, { status: 404 });
  }

  const existingMemories = memories.filter((memory) => memory.id !== draftMemory.id);
  const result = await createRecalliaAiRun({
    userId: user.id,
    memoryId: draftMemory.id,
    draftMemory,
    existingMemories
  });

  await store.upsertAiRun(result.aiRun);

  return NextResponse.json({
    aiRun: result.aiRun,
    suggestion: result.suggestion,
    adapterMode: result.adapterMode,
    validationWarnings: result.validationWarnings,
    fallbackReason: result.fallbackReason
  });
}
