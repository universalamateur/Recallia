# Recallia MVP Spec

## Product Summary

Recallia is a personal memory system that helps users capture life memories, place them on a timeline, and use AI to suggest relationships between memories.

The MVP should demonstrate one polished workflow:

> A user logs in, views seeded memories, adds a new uncertain memory, asks AI to help place it in time, confirms suggested links, and sees the updated memory persisted on a timeline.

Codex/ChatGPT-style model use should happen through a server-side API route wrapper around the OpenAI Responses API.

## Core Demo Story

Seeded memories:

| Title | Date range | Tags |
|---|---|---|
| Owned beige VW Golf 1 | 1992-2000 | car, Germany, personal artifact |
| Lived in Frankfurt | 1995-1999 | place, home |
| Attended evening school | 1996-1998 | education |

Live demo memory:

> I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.

When the user clicks **Ask Recallia AI**, the app should suggest:

- Possible date range: 1996-1999.
- Reason: overlaps with living in Frankfurt, owning the Golf, and attending evening school.
- Suggested links: Lived in Frankfurt, Owned beige VW Golf 1, Attended evening school.
- Clarifying question: Was this during your evening school period or before that?

The user confirms, saves, and sees the memory inserted into the timeline.

## Demo Wow Moment

When the AI suggestion appears, the timeline should visibly connect the draft memory to the three relevant seeded memories:

- Highlight the suggested 1996-1999 date range.
- Highlight the linked memory cards.
- Show a before/after state when the user accepts the suggestion.

Keep this as lightweight UI polish in the existing timeline. Do not add a graph canvas or separate visualization system.

## Authentication

Implement simple demo authentication.

Required:

- Login page.
- Logout button.
- Protected app routes.
- Single demo user.
- Protected server reads and writes; route protection alone is not enough.
- Session cookie uses `httpOnly`, `sameSite=lax` or stricter, and `secure` when running in a production-like environment.
- Logout clears the session.

Demo credentials:

```text
email: demo@recallia.local
password: recallia
```

Tests:

- Unauthenticated users are redirected to login.
- Authenticated users can access the timeline.

## Persistence

Use file-backed local JSON for the MVP. Keep storage behind a small module so it can be replaced later only if the demo proves JSON insufficient.

Storage requirements:

- Runtime data lives outside public/static paths.
- `store.ts` creates the data directory if needed.
- Writes use temp-file plus rename so interrupted writes do not corrupt the JSON file.
- Tests can point storage at an isolated temp path.
- Provide a documented reset path for wiping local memories and AI traces before or after the Loom recording.

Draft lifecycle:

- Saving or asking AI creates or reuses a persisted draft memory.
- AI runs always attach to a persisted `memoryId`.
- Accepting a suggestion updates that same memory; rejecting keeps the run trace but does not mutate the timeline placement or links.

Persist `Memory`:

```ts
type Memory = {
  id: string;
  userId: string;
  status: "draft" | "saved";
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  dateConfidence: "exact" | "approximate" | "unknown";
  location?: string;
  people: string[];
  tags: string[];
  linkedMemoryIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

Persist `AiRun`:

```ts
type AiRun = {
  id: string;
  userId: string;
  memoryId: string;
  inputSnapshot: string;
  existingMemorySnapshot: string;
  aiResponse: string;
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  suggestedLinkedMemoryIds: string[];
  clarifyingQuestion?: string;
  adapterMode: "codex" | "mock";
  status: "pending" | "accepted" | "accepted_with_edits" | "rejected";
  createdAt: string;
};
```

Required:

- Seed demo memories on first run.
- Persist newly created memories.
- Persist AI run metadata.
- Show AI run history for the selected memory.
- Filter every memory and AI run read/write by the authenticated demo user.

Tests:

- Created memories survive reload/database read.
- AI run output is saved.

## Main Screens

### Login Screen

Show:

- App name: Recallia.
- Blurb: "Turn scattered life memories into a connected timeline."
- Email/password fields.
- Login button.

### Timeline Screen

Main authenticated view.

Show:

- Timeline of memories sorted by start date.
- Memory cards.
- Date/date range.
- Description preview.
- Tags.
- Linked memories.
- Add Memory button.

### Add Memory Screen Or Modal

Fields:

- Title.
- Description.
- Start date optional.
- End date optional.
- Date confidence.
- Location optional.
- People.
- Tags.

Actions:

- Save Draft.
- Ask Recallia AI.

### AI Suggestion Panel

After clicking **Ask Recallia AI**, show:

- Suggested date range.
- Confidence explanation.
- Suggested linked memories.
- Clarifying question.
- Adapter mode: real OpenAI API response or mock fallback.
- Raw/traceable AI prompt and response collapsed under "AI trace".
- Disclosure: "AI suggestions are advisory; nothing changes until you confirm. Trace data may include memory text."

Actions:

- Accept suggestions.
- Edit manually.
- Reject suggestions.

AI should advise, not silently mutate the timeline.

## Codex/OpenAI Integration

Implement a Next.js route handler at `POST /api/ai/suggest`. The browser calls this route; only the route calls the AI adapter.

Implement a server-side adapter:

```ts
interface RecalliaAiAdapter {
  suggestMemoryPlacement(input: {
    draftMemory: Partial<Memory>;
    existingMemories: Memory[];
  }): Promise<MemoryPlacementSuggestion>;
}

type MemoryPlacementSuggestion = {
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  dateConfidence: "exact" | "approximate" | "unknown";
  suggestedLinkedMemoryIds: string[];
  reasoning: string;
  clarifyingQuestion?: string;
};
```

Implementation requirements:

- Put OpenAI API calls behind the adapter.
- Implement the real path with the OpenAI Responses API from the server route.
- Use Structured Outputs or equivalent strict JSON schema validation for `MemoryPlacementSuggestion`.
- Real mode requires both `RECALLIA_AI_MODE=codex` and `OPENAI_API_KEY`.
- Mock mode is the default when real mode is not explicitly configured.
- Use a deterministic mock adapter fallback for local testing and demo stability.
- Use a short timeout for real API calls; timeout, missing config, API error, malformed output, or schema failure returns a visible mock fallback or validation error, never a silent fake real-mode run.
- Never call the OpenAI API directly from the browser.
- Store prompt/input and response/output for traceability using synthetic demo data only.
- Show whether each AI run used the real OpenAI API path or mock fallback in the collapsed AI trace.
- Treat model output as untrusted input: reject unsupported fields, malformed JSON, invented memory IDs, unsafe mutations, and linked IDs that are not in the scoped existing memories.

## AI Prompt Template

```text
You are Recallia AI, a memory timeline assistant.
Your job is to help place a new personal memory into a timeline by comparing it with existing memories.

Rules:
- Do not invent facts.
- Use only the provided draft memory and existing memories.
- Suggest date ranges only when supported by overlaps.
- Prefer asking a clarifying question when uncertain.
- Return structured JSON only.

Draft memory:
{{draftMemory}}

Existing memories:
{{existingMemories}}

Return:
{
  "suggestedStartDate": string | null,
  "suggestedEndDate": string | null,
  "dateConfidence": "exact" | "approximate" | "unknown",
  "suggestedLinkedMemoryIds": string[],
  "reasoning": string,
  "clarifyingQuestion": string | null
}
```

## Tests

Implement at least these tests:

- Auth: invalid password is rejected, unauthenticated users cannot access `/timeline`, demo login succeeds, logout blocks protected access again, and write routes reject unauthenticated mutation.
- Persistence: creating a memory writes it to isolated test storage, reload/read returns the same memory, and writes do not corrupt existing data.
- AI adapter: mock adapter receives draft memory and existing memories, returns expected suggested links, persists `adapterMode`, and is deterministic.
- AI validation: malformed model output, invented memory IDs, unknown linked IDs, empty draft input, and prompt-injection-like memory text are rejected or safely ignored.
- AI mutation: asking AI creates an `AiRun` but does not update dates or links until Accept.
- Accept/reject/edit: accept applies suggestions, reject records `status: "rejected"` without applying them, and edit records `status: "accepted_with_edits"`.
- Timeline: memories render in chronological order; missing dates sort after dated memories; same start dates sort by `createdAt`; date ranges sort by `startDate`; newly accepted memory appears in the suggested date range.
- Browser smoke: login, see seeded memories, create the Frank memory, ask AI, see the 1996-1999 range and three highlighted links, accept, reload, confirm persisted timeline and AI trace.
- Boundary: browser code never imports or calls the OpenAI adapter directly.

## MVP Non-Goals

Do not build:

- Real multi-user accounts.
- Real photo upload.
- Real cloud storage.
- Social sharing.
- Complex graph visualization.
- Real third-party integrations.
- Production-grade auth.
- Mobile app.

For photos, include only a placeholder field or future note.

## Privacy Constraints

- Use deterministic synthetic demo data only.
- Do not enter real personal, customer, health, financial, minor-related, or sensitive relationship data.
- Local JSON persistence is for the demo only and is ignored by git.
- No analytics, telemetry, cloud storage, or third-party integrations beyond the optional OpenAI API call.
- Demo auth is local gating only, not a production privacy or security control.
- Real OpenAI API mode sends scoped memory text to the provider; mock mode keeps all AI suggestion behavior local.
- Raw AI trace snapshots are retained only for demo traceability, should stay collapsed by default, and must be resettable.

## Security And Safety Notes

Top risks:

1. False memory creation.
2. Sensitive personal data leakage.
3. Opaque AI behavior.
4. Prompt injection through memory text.

Mitigations:

- AI can only suggest; user must confirm.
- Local-only demo persistence.
- No third-party APIs except the optional OpenAI API adapter.
- Show AI prompt/response trace and persist run history.
- Scope OpenAI input to the draft memory plus existing memory summaries.
- Validate AI output server-side before display or mutation.
- Keep runtime data, env files, and local Codex config out of git.

## Success Criteria

- App runs locally from a clean checkout.
- Login works.
- Seeded memories appear.
- User can create a new memory.
- AI suggests placement and links.
- User can accept suggestions.
- Memory and AI run are persisted.
- Tests pass.
- Local data reset path is documented.
- Demo has a clear before/after moment.
- Loom recording explains both the app demo and how Codex was used to build and run the AI workflow.
