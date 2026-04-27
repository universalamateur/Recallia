# Recallia

![Recallia logo](logo.png)

Recallia is a local demo memory system that helps turn scattered life events into a connected timeline with AI-assisted placement.

The MVP is intentionally narrow: one demo user, one uncertain memory, one AI suggestion, one human confirmation, and one persisted result.

## Demo Credentials

```text
email: demo@recallia.local
password: recallia
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with the demo credentials, and follow the seeded Frank/Frankfurt/Golf refinement flow.

Useful commands:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run data:reset
```

Run `npm run test:e2e` with no existing `next dev` server for this repo. The Playwright smoke test starts its own isolated server and uses `data/e2e-recallia.json`.

`npm run data:reset` removes the default local runtime file at `data/recallia.json`. Runtime JSON files are ignored by git.

## AI Mode

Mock mode is the default and is deterministic for the Loom demo.

Real OpenAI mode is server-side only:

```bash
RECALLIA_AI_MODE=codex OPENAI_API_KEY=... npm run dev
```

Optional:

```bash
RECALLIA_OPENAI_MODEL=gpt-5.5
```

The browser calls `POST /api/ai/suggest`; only the server route calls the AI adapter. AI output is validated and stored as an `AiRun` trace. Suggestions do not mutate timeline dates or links until the user accepts or edits them. Pending suggestions can be refined by selecting which seeded residence, car, work, and learning memories were true at the same time.

## Demo Flow

1. Log in with local demo credentials.
2. View the seeded timeline.
3. Add the uncertain Frank memory.
4. Click **Ask Recallia AI**.
5. Review the broad 1995-1999 suggestion from Frankfurt plus the beige Golf.
6. Select additional parallel facts, such as evening school and logistics work, then refine to 1997-1998.
7. Accept, edit, or reject the suggestion.
8. Reload and confirm the accepted result persists as a normal timeline memory.

The AI trace is shown collapsed while reviewing a pending suggestion. After acceptance, the trace remains persisted in local JSON but the sidebar returns to the clean Add Memory state.

## Stack

- Next.js App Router + TypeScript.
- File-backed local JSON persistence.
- Server-side OpenAI Responses API adapter with deterministic mock fallback.
- Vitest unit/integration tests.
- Playwright browser smoke test for the Loom path.

## Project Docs

- [SPEC.md](SPEC.md): MVP product contract, data model, AI safety, and non-goals.
- [AGENTS.md](AGENTS.md): agent instructions and design principles.
- [PLAN.md](PLAN.md): implemented MVP status and acceptance checklist.

## Known MVP Limits

- Demo auth is local gating only, not production authentication.
- Local JSON persistence is for the demo only.
- No uploads, cloud storage, graph canvas, social features, or third-party integrations beyond optional OpenAI API mode.
- Use deterministic synthetic demo data only.
