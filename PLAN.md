# Recallia Build Plan

## Status

Implemented MVP and Codex SDK adapter. This file is now a final status checklist, not the active work queue.

## Final Demo Path

1. Log in with `demo@recallia.local` / `recallia`.
2. Review the seeded vertical timeline with overlapping residence, car, work, and learning memories.
3. Click **Add Memory** to reveal the prefilled Frank memory form.
4. Click **Ask Recallia AI** to create a persisted draft and pending AI run. For the Codex SDK v2 recording, this first suggestion should use real Codex mode.
5. Review the broad 1995-1999 suggestion and collapsed AI trace.
6. Select evening school and logistics work, then click **Refine suggestion** to narrow the range to 1997-1998.
7. Accept the suggestion.
8. Confirm the sidebar returns to **Add Memory** only and the accepted Frank memory persists as a normal timeline card after reload.

## Acceptance Checklist

- [x] `npm install` works from a clean checkout.
- [x] `npm run dev` starts the app.
- [x] `npm test` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Browser smoke test covers the deterministic mock-mode demo path; the real-Codex walkthrough is verified manually.
- [x] Login redirects unauthenticated users.
- [x] Invalid password is rejected and logout blocks protected access.
- [x] Write routes reject unauthenticated mutation.
- [x] Demo user can view seeded timeline.
- [x] Demo user can create the Frank/Frankfurt/Golf draft by clicking **Ask Recallia AI**.
- [x] Ask Recallia AI returns deterministic suggested links in mock mode for tests and offline demo stability.
- [x] AI trace shows adapter mode and input/output snapshots while the run is pending.
- [x] Malformed AI output and unknown linked memory IDs are rejected or safely ignored.
- [x] Asking AI does not mutate dates or links before the user accepts.
- [x] User can refine suggestions from selected overlapping memories.
- [x] User can accept suggestions.
- [x] User can reject suggestions without applying them.
- [x] User can edit suggestions and record `accepted_with_edits`.
- [x] New memory and AI run metadata persist.
- [x] Timeline highlights suggested range and linked memories before acceptance.
- [x] After acceptance, the sidebar returns to Add Memory only and AI highlights disappear.
- [x] Timeline ordering handles missing dates, approximate dates, same start dates, and date ranges.
- [x] `npm run data:reset` clears local runtime data and default Codex scratch/session state.
- [x] README explains setup, tests, demo credentials, AI mode, reset, and e2e constraints.

## Final Verification

Run before final handoff:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Run `npm run test:e2e` with no existing `next dev` server for this repo; Playwright starts its own isolated server on `127.0.0.1:3210`.
