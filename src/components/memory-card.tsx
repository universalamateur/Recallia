import { formatDateRange } from "@/lib/timeline";
import type { Memory } from "@/lib/types";

type MemoryCardProps = {
  memory: Memory;
  linkedTitles: string[];
  highlight?: "suggested-memory" | "suggested-link";
  variant?: "full" | "timeline";
};

function memoryKind(memory: Memory) {
  if (memory.tags.includes("place")) {
    return "place";
  }

  if (memory.tags.includes("car")) {
    return "car";
  }

  if (memory.tags.includes("work")) {
    return "work";
  }

  if (memory.tags.includes("education") || memory.tags.includes("learning")) {
    return "learning";
  }

  return "general";
}

export function MemoryCard({
  memory,
  linkedTitles,
  highlight,
  variant = "full"
}: MemoryCardProps) {
  return (
    <article
      className={`memory-card memory-card-${variant} memory-card-kind-${memoryKind(memory)} ${highlight ? `memory-card-${highlight}` : ""}`}
    >
      <div className="memory-card-header">
        <div>
          <p className="memory-date">{formatDateRange(memory)}</p>
          <h2>{memory.title}</h2>
        </div>
        <div className="pill-stack">
          {highlight === "suggested-memory" ? (
            <span className="status-pill">AI memory</span>
          ) : null}
          {highlight === "suggested-link" ? (
            <span className="status-pill">AI link</span>
          ) : null}
          {memory.status === "draft" ? <span className="status-pill">Draft</span> : null}
        </div>
      </div>
      <p className="memory-description">{memory.description}</p>
      <div className="memory-meta">
        <span>{memory.dateConfidence}</span>
        {memory.location ? <span>{memory.location}</span> : null}
        {memory.people.length ? <span>{memory.people.join(", ")}</span> : null}
      </div>
      {memory.tags.length ? (
        <div className="tag-row">
          {memory.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="linked-row">
        <strong>Linked memories</strong>
        <span>{linkedTitles.length ? linkedTitles.join(", ") : "No links yet"}</span>
      </div>
    </article>
  );
}
