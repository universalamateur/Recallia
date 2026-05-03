import { MemoryCard } from "@/components/memory-card";
import type { Memory } from "@/lib/types";

type TimelineRailProps = {
  memories: Memory[];
  activeMemoryId?: string;
  linkedHighlightIds: Set<string>;
  suggestedRangeByMemoryId: Map<string, { startDate?: string; endDate?: string }>;
};

type PositionedMemory = {
  memory: Memory;
  startYear: number;
  endYear: number;
  rowStart: number;
  rowSpan: number;
  column: number;
};

const LEFT_COLUMNS = [2, 1];
const RIGHT_COLUMNS = [4, 5, 6];
const RAIL_COLUMN = 3;
const MIN_YEAR_SPAN = 1;

function yearFromDate(date?: string) {
  return date ? Number(date.slice(0, 4)) : undefined;
}

function visualDateRange(memory: Memory, suggestedRange?: { startDate?: string; endDate?: string }) {
  const startDate = memory.startDate ?? suggestedRange?.startDate;
  const endDate = memory.endDate ?? suggestedRange?.endDate ?? startDate;

  return {
    startDate,
    endDate
  };
}

function preferredColumns(memory: Memory) {
  if (memory.tags.includes("place") || memory.tags.includes("home")) {
    return RIGHT_COLUMNS;
  }

  if (memory.tags.includes("car")) {
    return [5, 6, 4];
  }

  return LEFT_COLUMNS;
}

function assignColumn(input: {
  memory: Memory;
  rowStart: number;
  rowEnd: number;
  occupiedUntilByColumn: Map<number, number>;
}) {
  const columns = preferredColumns(input.memory);
  const fallbackColumns = [...LEFT_COLUMNS, ...RIGHT_COLUMNS].filter(
    (column) => !columns.includes(column)
  );

  for (const column of [...columns, ...fallbackColumns]) {
    if ((input.occupiedUntilByColumn.get(column) ?? 0) < input.rowStart) {
      input.occupiedUntilByColumn.set(column, input.rowEnd);
      return column;
    }
  }

  const leastBusyColumn = [...columns, ...fallbackColumns].sort(
    (first, second) =>
      (input.occupiedUntilByColumn.get(first) ?? 0) -
      (input.occupiedUntilByColumn.get(second) ?? 0)
  )[0];

  input.occupiedUntilByColumn.set(leastBusyColumn, input.rowEnd);
  return leastBusyColumn;
}

function positionMemories(input: {
  memories: Memory[];
  suggestedRangeByMemoryId: Map<string, { startDate?: string; endDate?: string }>;
}) {
  const dated = input.memories
    .map((memory) => {
      const visualRange = visualDateRange(memory, input.suggestedRangeByMemoryId.get(memory.id));
      const startYear = yearFromDate(visualRange.startDate);
      const endYear = yearFromDate(visualRange.endDate) ?? startYear;

      return startYear && endYear
        ? {
            memory,
            startYear,
            endYear: Math.max(startYear, endYear)
          }
        : undefined;
    })
    .filter((memory): memory is { memory: Memory; startYear: number; endYear: number } =>
      Boolean(memory)
    )
    .sort((first, second) => {
      if (first.startYear !== second.startYear) {
        return first.startYear - second.startYear;
      }

      return first.memory.createdAt.localeCompare(second.memory.createdAt);
    });

  const startYear = Math.min(...dated.map((item) => item.startYear));
  const endYear = Math.max(...dated.map((item) => item.endYear));
  const occupiedUntilByColumn = new Map<number, number>();
  const items: PositionedMemory[] = dated.map((item) => {
    const rowStart = item.startYear - startYear + 1;
    const rowSpan = Math.max(MIN_YEAR_SPAN, item.endYear - item.startYear + 1);
    const rowEnd = rowStart + rowSpan - 1;
    const column = assignColumn({
      memory: item.memory,
      rowStart,
      rowEnd,
      occupiedUntilByColumn
    });

    return {
      ...item,
      rowStart,
      rowSpan,
      column
    };
  });

  return {
    items,
    startYear,
    endYear,
    totalRows: endYear - startYear + 1
  };
}

function yearMarkers(startYear: number, endYear: number) {
  const markers = new Set([startYear, endYear]);

  for (let year = Math.ceil(startYear / 5) * 5; year <= endYear; year += 5) {
    markers.add(year);
  }

  return [...markers].sort((first, second) => first - second);
}

function linkedTitlesFor(memoryIdMap: Map<string, string>, linkedMemoryIds: string[]) {
  return linkedMemoryIds
    .map((memoryId) => memoryIdMap.get(memoryId))
    .filter((title): title is string => Boolean(title));
}

function highlightFor(input: {
  memoryId: string;
  activeMemoryId?: string;
  linkedHighlightIds: Set<string>;
}) {
  if (input.memoryId === input.activeMemoryId) {
    return "suggested-memory" as const;
  }

  if (input.linkedHighlightIds.has(input.memoryId)) {
    return "suggested-link" as const;
  }

  return undefined;
}

export function TimelineRail({
  memories,
  activeMemoryId,
  linkedHighlightIds,
  suggestedRangeByMemoryId
}: TimelineRailProps) {
  const positioned = positionMemories({ memories, suggestedRangeByMemoryId });
  const memoryIdMap = new Map(memories.map((memory) => [memory.id, memory.title]));

  return (
    <div className="timeline-rail" aria-label="Memory timeline">
      <div
        className="timeline-grid"
        style={{
          gridTemplateRows: `repeat(${positioned.totalRows}, var(--timeline-year-height))`
        }}
      >
        <div
          aria-hidden="true"
          className="timeline-axis"
          style={{
            gridColumn: RAIL_COLUMN,
            gridRow: `1 / span ${positioned.totalRows}`
          }}
        />
        {yearMarkers(positioned.startYear, positioned.endYear).map((year) => (
          <div
            className="timeline-year-marker"
            key={year}
            style={{
              gridColumn: RAIL_COLUMN,
              gridRow: year - positioned.startYear + 1
            }}
          >
            <span>{year}</span>
          </div>
        ))}
        {positioned.items.map((item) => (
          <div
            className="timeline-item"
            data-timeline-side={item.column < RAIL_COLUMN ? "left" : "right"}
            key={item.memory.id}
            style={{
              gridColumn: item.column,
              gridRow: `${item.rowStart} / span ${item.rowSpan}`
            }}
          >
            <MemoryCard
              highlight={highlightFor({
                memoryId: item.memory.id,
                activeMemoryId,
                linkedHighlightIds
              })}
              linkedTitles={linkedTitlesFor(memoryIdMap, item.memory.linkedMemoryIds)}
              memory={item.memory}
              variant="timeline"
            />
          </div>
        ))}
        {memories.some((memory) => {
          const range = visualDateRange(memory, suggestedRangeByMemoryId.get(memory.id));
          return !range.startDate;
        }) ? (
          <section
            className="undated-memories"
            style={{
              gridColumn: "1 / -1",
              gridRow: `${positioned.totalRows + 1}`
            }}
          >
            <strong>Unplaced memories</strong>
            <div>
              {memories
                .filter((memory) => {
                  const range = visualDateRange(memory, suggestedRangeByMemoryId.get(memory.id));
                  return !range.startDate;
                })
                .map((memory) => (
                  <span key={memory.id}>{memory.title}</span>
                ))}
            </div>
          </section>
        ) : null}
      </div>
      <p className="timeline-rail-note">
        Cards span the years they cover. Hover a memory to lift it above nearby overlaps.
      </p>
    </div>
  );
}
