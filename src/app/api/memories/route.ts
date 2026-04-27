import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { buildDraftMemory, DraftMemoryInputSchema } from "@/lib/memory-draft";
import { createStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = DraftMemoryInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft memory." }, { status: 400 });
  }

  const store = createStore();
  const userMemories = await store.listMemories(user.id);
  const existingDraft = userMemories.find(
    (memory) => memory.id === parsed.data.id && memory.status === "draft"
  );
  const memory = buildDraftMemory({
    userId: user.id,
    draft: parsed.data,
    existingDraft
  });

  await store.upsertMemory(memory);

  return NextResponse.json(
    {
      memory,
      intent: parsed.data.intent
    },
    { status: existingDraft ? 200 : 201 }
  );
}
