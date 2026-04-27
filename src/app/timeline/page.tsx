import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { MemoryComposer } from "@/components/memory-composer";
import { TimelineRail } from "@/components/timeline-rail";
import { createAiRunView } from "@/lib/ai-run-view";
import { getUserFromCookieHeader } from "@/lib/auth";
import { createStore } from "@/lib/store";
import { selectActiveTimelineRun, visibleMemoriesForTimeline } from "@/lib/timeline-active-run";
import { formatDateRange, sortMemoriesForTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TimelinePageProps = {
  searchParams?: Promise<{
    run?: string | string[];
  }>;
};

function runIdFromSearchParams(searchParams?: { run?: string | string[] }) {
  return Array.isArray(searchParams?.run) ? searchParams.run[0] : searchParams?.run;
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const cookieHeader = (await cookies()).toString();
  const user = getUserFromCookieHeader(cookieHeader);

  if (!user) {
    redirect("/login?next=/timeline");
  }

  const store = createStore();
  const [rawMemories, aiRuns] = await Promise.all([
    store.listMemories(user.id),
    store.listAiRuns(user.id)
  ]);
  const requestedRunId = runIdFromSearchParams(await searchParams);
  const activeRun = selectActiveTimelineRun({
    runId: requestedRunId,
    aiRuns,
    memories: rawMemories
  });
  const memories = sortMemoriesForTimeline(
    visibleMemoriesForTimeline({ memories: rawMemories, activeRun })
  );
  const memoryIdMap = new Map(rawMemories.map((memory) => [memory.id, memory.title]));
  const activeAiRunView = activeRun
    ? createAiRunView({ aiRun: activeRun.aiRun, memoryTitleById: memoryIdMap })
    : undefined;
  const candidateMemories = memories
    .filter((memory) => memory.id !== activeRun?.aiRun.memoryId && memory.status === "saved")
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      dateRange: formatDateRange(memory),
      tags: memory.tags
    }));
  const highlightedMemory = activeRun?.memory;
  const activeRunHighlights = activeRun?.aiRun;
  const linkedHighlightIds = new Set(
    activeRunHighlights
      ? highlightedMemory?.linkedMemoryIds.length
        ? highlightedMemory.linkedMemoryIds
        : activeRunHighlights.suggestedLinkedMemoryIds
      : []
  );
  const rangeHighlight =
    activeRunHighlights && highlightedMemory
      ? formatDateRange({
          startDate: highlightedMemory.startDate ?? activeRunHighlights.suggestedStartDate,
          endDate: highlightedMemory.endDate ?? activeRunHighlights.suggestedEndDate
        })
      : undefined;
  const suggestedRangeByMemoryId = new Map<string, { startDate?: string; endDate?: string }>();

  if (activeRunHighlights) {
    suggestedRangeByMemoryId.set(activeRunHighlights.memoryId, {
      startDate: activeRunHighlights.suggestedStartDate,
      endDate: activeRunHighlights.suggestedEndDate
    });
  }

  return (
    <section className="timeline-page">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h1>Memory timeline</h1>
          <p className="lead">
            Signed in as the local demo user. Add the uncertain Frank memory,
            ask Recallia AI for placement, then accept only what should persist.
          </p>
        </div>
        <LogoutButton />
      </div>
      <div className="timeline-layout">
        <section className="timeline-list" aria-label="Memory timeline">
          {rangeHighlight && rangeHighlight !== "Date unknown" ? (
            <div className="range-highlight">
              <strong>
                {activeRunHighlights?.status === "pending" ? "Suggested range" : "Accepted range"}
              </strong>
              <span>{rangeHighlight}</span>
            </div>
          ) : null}
          <TimelineRail
            activeMemoryId={activeRunHighlights?.memoryId}
            linkedHighlightIds={linkedHighlightIds}
            memories={memories}
            suggestedRangeByMemoryId={suggestedRangeByMemoryId}
          />
        </section>
        <div className="timeline-side">
          <MemoryComposer
            activeAiRun={activeAiRunView}
            candidateMemories={candidateMemories}
            key={activeAiRunView?.id ?? "idle"}
          />
        </div>
      </div>
    </section>
  );
}
