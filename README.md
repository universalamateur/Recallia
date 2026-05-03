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

`npm run data:reset` removes the default local runtime file at `data/recallia.json` and the default Codex scratch directory under the operating system temp directory. Runtime JSON files and scratch state are ignored by git.

## AI Mode

Mock mode is the default for tests and offline demos. For the Codex SDK v2 recording, the product walkthrough should run the first **Ask Recallia AI** step in real Codex mode, then keep refinement deterministic in the app.

Real mode is server-side only and uses the Codex SDK adapter behind `POST /api/ai/suggest`:

```bash
RECALLIA_AI_MODE=codex OPENAI_API_KEY=... npm run dev
```

Optional overrides:

```bash
RECALLIA_CODEX_MODEL=<codex-model>
RECALLIA_CODEX_WORKING_DIRECTORY=<private-scratch-directory>
RECALLIA_CODEX_PATH=<optional-path-to-codex-binary>
```

The browser calls `POST /api/ai/suggest`; only the server route calls the AI adapter. AI output is validated and stored as an `AiRun` trace. Suggestions do not mutate timeline dates or links until the user accepts or edits them. Pending suggestions can be refined by selecting which seeded residence, car, work, and learning memories were true at the same time.

Real Codex calls wait up to 60 seconds before falling back to deterministic mock mode so the recorded demo can tolerate first-run SDK startup latency. Successful SDK calls persist `adapterMode: "codex"`. Any timeout or SDK error persists `adapterMode: "mock"` with a visible `fallbackReason`.

The real adapter starts Codex with `sandboxMode: "read-only"`, `approvalPolicy: "never"`, `webSearchMode: "disabled"`, and a scratch working directory outside the repo and `data/`. By default that scratch directory is `<os-temp>/recallia-codex-scratch`; the adapter creates private `home`, `codex-home`, and `tmp` directories there and passes only a minimal subprocess environment. Custom `RECALLIA_CODEX_WORKING_DIRECTORY` values are operator-managed, are rejected if they point inside the repo or runtime data, and are not removed by `npm run data:reset`.

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
- Server-side Codex SDK adapter with deterministic mock fallback.
- Vitest unit/integration tests.
- Playwright browser smoke test for the deterministic mock-mode demo path.

## Documentation Map

Current demo contract:

- [SPEC.md](SPEC.md): implemented MVP product contract, data model, AI safety, and non-goals.
- [SPEC-CODEX-SDK-V2.md](SPEC-CODEX-SDK-V2.md): implemented Codex SDK adapter contract.
- [DEMO-SCRIPT.md](DEMO-SCRIPT.md): short recording script for the OpenAI demo.
- [PLAN.md](PLAN.md): final demo path, acceptance checklist, and verification commands.
- [AGENTS.md](AGENTS.md): agent instructions, source-of-truth order, and design principles.

Future production planning:

- [ROADMAP.md](ROADMAP.md): phased path from the OpenAI demo baseline to production MVP, database decision, self-hosted multi-user, and SaaS readiness.
- [SPEC-PRODUCTION-MVP.md](SPEC-PRODUCTION-MVP.md): future production MVP contract. It does not override the current demo `SPEC.md` until production work starts.

## Known MVP Limits

- Demo auth is local gating only, not production authentication.
- Local JSON persistence is for the demo only.
- No uploads, cloud storage, graph canvas, social features, or third-party integrations beyond optional server-side Codex SDK model mode.
- Use deterministic synthetic demo data only.
- Real Codex mode sends the scoped draft memory and seeded memory summaries to OpenAI; do not use real personal, customer, health, financial, minor-related, or sensitive relationship data.
