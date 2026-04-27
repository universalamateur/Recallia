"use client";

import { Check, Pencil, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { AiRunView } from "@/lib/ai-run-view";

export type AiCandidateMemory = {
  id: string;
  title: string;
  dateRange: string;
  tags: string[];
};

type AiSuggestionPanelProps = {
  run?: AiRunView;
  candidateMemories: AiCandidateMemory[];
};

type CandidateGroup = {
  label: string;
  memories: AiCandidateMemory[];
};

function candidateGroupFor(memory: AiCandidateMemory) {
  if (memory.tags.includes("place")) {
    return "Where were you living?";
  }

  if (memory.tags.includes("car")) {
    return "Which car fits?";
  }

  if (memory.tags.includes("work") || memory.tags.includes("education")) {
    return "What work or learning was happening?";
  }

  return "Other related facts";
}

function groupCandidateMemories(memories: AiCandidateMemory[]): CandidateGroup[] {
  const groups = new Map<string, AiCandidateMemory[]>();

  for (const memory of memories) {
    const label = candidateGroupFor(memory);
    groups.set(label, [...(groups.get(label) ?? []), memory]);
  }

  return ["Where were you living?", "Which car fits?", "What work or learning was happening?", "Other related facts"]
    .map((label) => ({ label, memories: groups.get(label) ?? [] }))
    .filter((group) => group.memories.length);
}

export function AiSuggestionPanel({ run, candidateMemories }: AiSuggestionPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  if (!run) {
    return null;
  }

  const activeRun = run;
  const isPending = activeRun.status === "pending";

  async function postRunAction(
    path: string,
    body: Record<string, unknown> | undefined,
    successMessage: string,
    afterSuccess: "refresh" | "close" = "refresh"
  ) {
    setMessage("");
    setError("");
    setIsWorking(true);

    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const responseBody = await response.json();

    setIsWorking(false);

    if (!response.ok) {
      setError(responseBody.error ?? "Could not update the AI suggestion.");
      return;
    }

    setMessage(successMessage);

    if (afterSuccess === "close") {
      router.push("/timeline");
      return;
    }

    router.refresh();
  }

  async function acceptSuggestion() {
    await postRunAction(
      `/api/ai/runs/${encodeURIComponent(activeRun.id)}/accept`,
      {},
      "Suggestion accepted and applied to the timeline.",
      "close"
    );
  }

  async function rejectSuggestion() {
    await postRunAction(
      `/api/ai/runs/${encodeURIComponent(activeRun.id)}/reject`,
      {},
      "Suggestion rejected. Timeline placement was not changed.",
      "close"
    );
  }

  async function refineSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await postRunAction(
      `/api/ai/runs/${encodeURIComponent(activeRun.id)}/refine`,
      {
        linkedMemoryIds: formData.getAll("linkedMemoryIds")
      },
      "Suggestion refined from selected memories."
    );
  }

  async function editSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await postRunAction(
      `/api/ai/runs/${encodeURIComponent(activeRun.id)}/accept`,
      {
        edits: {
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          dateConfidence: formData.get("dateConfidence"),
          linkedMemoryIds: formData.getAll("linkedMemoryIds")
        }
      },
      "Edited suggestion applied to the timeline.",
      "close"
    );
  }

  return (
    <section className="ai-panel" aria-labelledby="ai-panel-heading">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Recallia AI</p>
          <h2 id="ai-panel-heading">Suggestion</h2>
        </div>
        <span className="status-pill">{activeRun.status}</span>
      </div>
      <p className="ai-disclosure">
        AI suggestions are advisory; nothing changes until you confirm. Trace data may
        include memory text.
      </p>
      <dl className="suggestion-list">
        <div>
          <dt>Suggested range</dt>
          <dd>{activeRun.suggestedDateRange}</dd>
        </div>
        <div>
          <dt>Adapter mode</dt>
          <dd>{activeRun.adapterMode}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{activeRun.reasoning}</dd>
        </div>
        <div>
          <dt>Suggested links</dt>
          <dd>
            {activeRun.suggestedLinkedMemories.length
              ? activeRun.suggestedLinkedMemories.map((memory) => memory.title).join(", ")
              : "No links suggested"}
          </dd>
        </div>
        {activeRun.clarifyingQuestion ? (
          <div>
            <dt>Clarifying question</dt>
            <dd>{activeRun.clarifyingQuestion}</dd>
          </div>
        ) : null}
      </dl>
      {activeRun.fallbackReason ? (
        <p className="form-error">Mock fallback used: {activeRun.fallbackReason}</p>
      ) : null}
      {activeRun.validationWarnings.length ? (
        <p className="form-error">{activeRun.validationWarnings.join(" ")}</p>
      ) : null}
      {isPending ? (
        <>
          <form
            className="refine-form"
            key={`${activeRun.id}-refine-${activeRun.suggestedLinkedMemoryIds.join("-")}`}
            onSubmit={refineSuggestion}
          >
            {groupCandidateMemories(candidateMemories).map((group) => (
              <fieldset key={group.label}>
                <legend>{group.label}</legend>
                {group.memories.map((memory) => (
                  <label key={memory.id}>
                    <input
                      defaultChecked={activeRun.suggestedLinkedMemoryIds.includes(memory.id)}
                      name="linkedMemoryIds"
                      type="checkbox"
                      value={memory.id}
                    />
                    <span>
                      <strong>{memory.title}</strong>
                      <small>{memory.dateRange}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
            <button className="button secondary" disabled={isWorking} type="submit">
              <RefreshCw aria-hidden="true" size={18} />
              Refine suggestion
            </button>
          </form>
          <div className="actions">
            <button
              className="button"
              disabled={isWorking}
              onClick={() => {
                void acceptSuggestion();
              }}
              type="button"
            >
              <Check aria-hidden="true" size={18} />
              Accept suggestions
            </button>
            <button
              className="button secondary"
              disabled={isWorking}
              onClick={() => {
                void rejectSuggestion();
              }}
              type="button"
            >
              <X aria-hidden="true" size={18} />
              Reject
            </button>
          </div>
          <form
            className="manual-edit-form"
            key={`${activeRun.id}-edit-${activeRun.suggestedStartDate ?? ""}-${activeRun.suggestedEndDate ?? ""}`}
            onSubmit={editSuggestion}
          >
            <div className="form-grid">
              <label>
                Start date
                <input
                  defaultValue={activeRun.suggestedStartDate ?? ""}
                  name="startDate"
                  type="date"
                />
              </label>
              <label>
                End date
                <input
                  defaultValue={activeRun.suggestedEndDate ?? ""}
                  name="endDate"
                  type="date"
                />
              </label>
            </div>
            <label>
              Date confidence
              <select defaultValue="approximate" name="dateConfidence">
                <option value="unknown">Unknown</option>
                <option value="approximate">Approximate</option>
                <option value="exact">Exact</option>
              </select>
            </label>
            <fieldset>
              <legend>Linked memories</legend>
              {activeRun.suggestedLinkedMemories.map((memory) => (
                <label key={memory.id}>
                  <input defaultChecked name="linkedMemoryIds" type="checkbox" value={memory.id} />
                  {memory.title}
                </label>
              ))}
            </fieldset>
            <button className="button secondary" disabled={isWorking} type="submit">
              <Pencil aria-hidden="true" size={18} />
              Edit manually
            </button>
          </form>
        </>
      ) : null}
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <details className="ai-trace">
        <summary>AI trace</summary>
        <h3>Draft memory snapshot</h3>
        <pre>{activeRun.inputSnapshot}</pre>
        <h3>Existing memory snapshot</h3>
        <pre>{activeRun.existingMemorySnapshot}</pre>
        <h3>AI response</h3>
        <pre>{activeRun.aiResponse}</pre>
      </details>
    </section>
  );
}
