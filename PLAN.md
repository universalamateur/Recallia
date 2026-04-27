# Recallia Build Plan

## Build Strategy

Build the smallest polished vertical slice first. The MVP is successful when the demo story works end-to-end and the tests prove the core behavior.

Recommended implementation order:

1. Scaffold Next.js + TypeScript.
2. Add local demo auth, protected routes, server-side auth checks, and auth tests.
3. Add file-backed persistence, seed memories, reset path, and storage tests.
4. Build timeline and memory creation UI.
5. Add `POST /api/ai/suggest`, OpenAI Responses API adapter, strict output validation, deterministic mock fallback, and adapter tests.
6. Add AI suggestion panel with accept/edit/reject and no-mutation-before-accept tests.
7. Persist AI run history with `status` and `adapterMode`.
8. Add the browser smoke test for the Loom path.
9. Polish the wow moment, README, and Loom notes.

## Timebox

| Timebox | Work |
|---|---|
| 0:00-0:20 | Scaffold app, scripts, base layout, visual direction |
| 0:20-0:50 | Login/logout, protected routes, demo credentials, auth tests |
| 0:50-1:25 | Persistence, seed memories, reset path, storage tests |
| 1:25-2:00 | Timeline read path, add-memory draft flow |
| 2:00-2:40 | API route wrapper, OpenAI Responses adapter, mock fallback, schema validation tests |
| 2:40-3:15 | AI panel, accept/reject/edit, persist AI run history, mutation tests |
| 3:15-3:35 | Browser smoke test for the full Loom path |
| 3:35-4:00 | Wow polish, README, final verification, Loom notes |

## Suggested File Shape

```text
src/
  app/
    login/
    timeline/
    api/
      memories/
      ai/suggest/route.ts
  components/
  lib/
    auth.ts
    store.ts
    seed.ts
    recallia-ai.ts
    recallia-ai-openai.ts
    recallia-ai-mock.ts
    recallia-ai-schema.ts
  test/
  e2e/
```

Adjust for the framework scaffold if needed; keep the architecture easy to explain in the Loom.

## Acceptance Checklist

- [ ] `npm install` works from a clean checkout.
- [ ] `npm run dev` starts the app.
- [ ] `npm test` passes.
- [ ] Browser smoke test covers the full Loom path.
- [ ] Login redirects unauthenticated users.
- [ ] Invalid password is rejected and logout blocks protected access.
- [ ] Write routes reject unauthenticated mutation.
- [ ] Demo user can view seeded timeline.
- [ ] Demo user can create the Frank/Frankfurt/Golf memory.
- [ ] Ask Recallia AI returns the expected suggested links.
- [ ] AI trace shows whether the run used real OpenAI API mode or mock fallback.
- [ ] Malformed AI output and unknown linked memory IDs are rejected or safely ignored.
- [ ] Asking AI does not mutate dates or links before the user accepts.
- [ ] User can accept suggestions.
- [ ] User can reject suggestions without applying them.
- [ ] User can edit suggestions and record `accepted_with_edits`.
- [ ] New memory and AI run history persist.
- [ ] Timeline highlights the suggested date range and linked memories before acceptance.
- [ ] Timeline ordering handles missing dates, approximate dates, same start dates, and date ranges.
- [ ] `npm run data:reset` or equivalent clears local runtime data.
- [ ] README explains setup, tests, demo credentials, and Codex integration mode.

## Loom Outline

- 0:00-2:30: Demo login, seeded timeline, uncertain memory, AI suggestion, highlighted links, acceptance, persisted result.
- 2:30-5:00: Explain the four-hour plan, Codex-assisted build flow, server-side OpenAI API route wrapper, mock fallback, persistence, privacy constraints, and tests.

Keep the recording focused on one polished loop rather than feature inventory.
