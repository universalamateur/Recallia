import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createStore } from "@/lib/store";
import { sortMemoriesForTimeline } from "@/lib/timeline";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const memories = await createStore().listMemories(user.id);
  return NextResponse.json({ memories: sortMemoriesForTimeline(memories) });
}
