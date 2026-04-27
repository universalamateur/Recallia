import type { Memory } from "@/lib/types";

function compareText(first = "", second = "") {
  return first.localeCompare(second);
}

export function sortMemoriesForTimeline(memories: Memory[]) {
  return [...memories].sort((first, second) => {
    const firstHasDate = Boolean(first.startDate);
    const secondHasDate = Boolean(second.startDate);

    if (firstHasDate !== secondHasDate) {
      return firstHasDate ? -1 : 1;
    }

    if (first.startDate && second.startDate && first.startDate !== second.startDate) {
      return compareText(first.startDate, second.startDate);
    }

    const createdAtOrder = compareText(first.createdAt, second.createdAt);
    if (createdAtOrder !== 0) {
      return createdAtOrder;
    }

    return compareText(first.title, second.title);
  });
}

function formatBoundary(value?: string) {
  if (!value) {
    return "";
  }

  if (value.endsWith("-01-01") || value.endsWith("-12-31")) {
    return value.slice(0, 4);
  }

  return value;
}

export function formatDateRange(memory: Pick<Memory, "startDate" | "endDate">) {
  if (!memory.startDate) {
    return "Date unknown";
  }

  if (!memory.endDate || memory.endDate === memory.startDate) {
    return formatBoundary(memory.startDate);
  }

  return `${formatBoundary(memory.startDate)}-${formatBoundary(memory.endDate)}`;
}
