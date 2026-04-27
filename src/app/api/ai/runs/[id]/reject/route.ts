import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
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

  const { id } = await context.params;
  const store = createStore();
  const aiRuns = await store.listAiRuns(user.id);
  const aiRun = aiRuns.find((run) => run.id === id);

  if (!aiRun) {
    return NextResponse.json({ error: "AI run not found." }, { status: 404 });
  }

  if (aiRun.status !== "pending") {
    return NextResponse.json({ error: "AI run is already closed." }, { status: 409 });
  }

  const rejectedRun = {
    ...aiRun,
    status: "rejected" as const
  };

  await store.upsertAiRun(rejectedRun);

  return NextResponse.json({ aiRun: rejectedRun });
}
