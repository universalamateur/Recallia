import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { RefineAiRunRequestSchema, refineAiRunSuggestion } from "@/lib/ai-run-refine";
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

  const parsed = RefineAiRunRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI refinement request." }, { status: 400 });
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

  try {
    const refinedRun = refineAiRunSuggestion({
      aiRun,
      existingMemories: memories.filter((memory) => memory.id !== aiRun.memoryId),
      request: parsed.data
    });

    await store.upsertAiRun(refinedRun);

    return NextResponse.json({ aiRun: refinedRun });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not refine AI run." },
      { status: 400 }
    );
  }
}
