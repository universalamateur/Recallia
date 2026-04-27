import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { AcceptAiRunRequestSchema, applyAiRunAcceptance } from "@/lib/ai-run-actions";
import { createStore } from "@/lib/store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const parsed = AcceptAiRunRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI run acceptance." }, { status: 400 });
  }

  const { id } = await context.params;
  const store = createStore();
  const [memories, aiRuns] = await Promise.all([
    store.listMemories(user.id),
    store.listAiRuns(user.id)
  ]);
  const aiRun = aiRuns.find((run) => run.id === id);

  if (!aiRun) {
    return NextResponse.json({ error: "AI run not found." }, { status: 404 });
  }

  if (aiRun.status !== "pending") {
    return NextResponse.json({ error: "AI run is already closed." }, { status: 409 });
  }

  const memory = memories.find((candidate) => candidate.id === aiRun.memoryId);

  if (!memory) {
    return NextResponse.json({ error: "Memory not found." }, { status: 404 });
  }

  try {
    const result = applyAiRunAcceptance({
      aiRun,
      memory,
      existingMemories: memories.filter((candidate) => candidate.id !== memory.id),
      request: parsed.data
    });

    await store.upsertMemory(result.memory);
    await store.upsertAiRun(result.aiRun);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not accept AI run." },
      { status: 400 }
    );
  }
}
