"use client";

import { Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiSuggestionPanel, type AiCandidateMemory } from "@/components/ai-suggestion-panel";
import type { AiRunView } from "@/lib/ai-run-view";

export function MemoryComposer({
  activeAiRun,
  candidateMemories
}: {
  activeAiRun?: AiRunView;
  candidateMemories: AiCandidateMemory[];
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(activeAiRun?.memoryId ?? null);
  const [mode, setMode] = useState<"idle" | "form">("idle");
  const [error, setError] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  async function askAiFromForm(form: HTMLFormElement) {
    setError("");
    setIsAsking(true);

    try {
      const formData = new FormData(form);
      const payload = {
        id: draftId ?? undefined,
        intent: "ask_ai",
        title: formData.get("title"),
        description: formData.get("description"),
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
        dateConfidence: formData.get("dateConfidence"),
        location: formData.get("location"),
        people: formData.get("people"),
        tags: formData.get("tags")
      };

      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not save the draft memory.");
        return;
      }

      setDraftId(body.memory.id);

      const aiResponse = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memoryId: body.memory.id })
      });
      const aiBody = await aiResponse.json();

      if (!aiResponse.ok) {
        setError(aiBody.error ?? "Could not ask Recallia AI.");
        return;
      }

      router.push(`/timeline?run=${encodeURIComponent(aiBody.aiRun.id)}`);
    } finally {
      setIsAsking(false);
    }
  }

  if (activeAiRun) {
    return (
      <section className="composer-panel" aria-labelledby="ai-panel-heading">
        <AiSuggestionPanel candidateMemories={candidateMemories} run={activeAiRun} />
      </section>
    );
  }

  if (mode === "idle") {
    return (
      <section className="composer-panel composer-panel-idle" aria-label="Add memory">
        <button
          className="button"
          onClick={() => {
            setDraftId(null);
            setError("");
            setMode("form");
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
          Add Memory
        </button>
      </section>
    );
  }

  return (
    <section className="composer-panel" aria-labelledby="add-memory-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Add Memory</p>
          <h2 id="add-memory-heading">Capture the uncertain Frank memory</h2>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setMode("idle");
          }}
          type="button"
        >
          <X aria-hidden="true" size={18} />
          Cancel
        </button>
      </div>
      <form
        className="memory-form"
        onSubmit={(event) => {
          event.preventDefault();
          void askAiFromForm(event.currentTarget);
        }}
      >
        <label>
          Title
          <input defaultValue="Met Frank in Frankfurt" name="title" required />
        </label>
        <label>
          Description
          <textarea
            defaultValue="I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf."
            name="description"
            required
            rows={5}
          />
        </label>
        <div className="form-grid">
          <label>
            Start date
            <input name="startDate" type="date" />
          </label>
          <label>
            End date
            <input name="endDate" type="date" />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Date confidence
            <select defaultValue="unknown" name="dateConfidence">
              <option value="unknown">Unknown</option>
              <option value="approximate">Approximate</option>
              <option value="exact">Exact</option>
            </select>
          </label>
          <label>
            Location
            <input defaultValue="Frankfurt" name="location" />
          </label>
        </div>
        <label>
          People
          <input defaultValue="Frank" name="people" />
        </label>
        <label>
          Tags
          <input defaultValue="friend, Frankfurt" name="tags" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="actions">
          <button className="button" disabled={isAsking} type="submit">
            <Sparkles aria-hidden="true" size={18} />
            {isAsking ? "Asking..." : "Ask Recallia AI"}
          </button>
        </div>
      </form>
    </section>
  );
}
