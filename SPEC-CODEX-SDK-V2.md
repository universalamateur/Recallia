# Recallia Codex SDK v2 Spec

Status: implemented adapter contract.

This file is the authoritative implementation contract for the Recallia Codex SDK adapter.

This spec describes the narrow transformation to the Codex SDK adapter. It does not expand the product beyond the existing refined Frank/Frankfurt/Golf demo flow.

## Goal

Use a server-only Codex SDK adapter:

```text
src/lib/recallia-ai-codex.ts -> @openai/codex-sdk
```

Everything else should stay the same unless required by this adapter swap:

- Demo auth.
- JSON persistence.
- Draft memory lifecycle.
- AI run persistence.
- Refine, accept, edit, reject actions.
- Deterministic mock mode.
- Existing refined demo flow.
- Existing e2e Loom path in mock mode, plus a real-Codex product walkthrough for the recorded demo.

## Current App Baseline

The current app already implements the refined demo flow:

1. Demo user logs in with `demo@recallia.local` / `recallia`.
2. `/timeline` shows a seeded timeline.
3. **Add Memory** opens the prefilled Frank memory form.
4. **Ask Recallia AI** persists or reuses a draft memory and creates a pending `AiRun`.
5. Mock mode returns a broad 1995-1999 suggestion linked to Frankfurt and the beige Golf.
6. The AI panel lets the user select parallel memories.
7. Selecting **Attended evening school** and **Worked at logistics warehouse** refines the suggestion to 1997-1998.
8. Accept applies the dates and links to the memory.
9. Reload shows the accepted memory as a normal timeline card.

Current implementation files:

- `src/lib/recallia-ai.ts`: adapter selection, fallback, `AiRun` creation.
- `src/lib/recallia-ai-codex.ts`: real adapter using the Codex SDK.
- `src/lib/recallia-ai-mock.ts`: deterministic mock adapter for demo and tests.
- `src/lib/recallia-ai-schema.ts`: strict schema gate and linked-memory validation.
- `src/lib/recallia-ai-prompt.ts`: prompt and scoped input snapshots.
- `src/app/api/ai/suggest/route.ts`: authenticated server route.
- `src/app/api/ai/runs/[id]/refine/route.ts`: deterministic refinement from selected overlapping memories.
- `src/app/api/ai/runs/[id]/accept/route.ts`: accepts or applies edited suggestions.
- `src/components/ai-suggestion-panel.tsx`: suggestion, refine, accept, edit, reject UI.
- `e2e/loom-path.spec.ts`: browser smoke test for the full demo path.

## Demo Data Assessment

The app already has enough seed memories for the refined demo. `src/lib/seed.ts` contains 16 deterministic memories:

- Residences: Hamburg, Frankfurt, Munich, Berlin, Zurich.
- Cars: beige VW Golf 1, red Opel Corsa, silver BMW 3 Series, blue Audi A4.
- Work: print shop apprenticeship, logistics warehouse, first IT support job, freelance web projects.
- Learning: evening school, software training, weekend product course.

No new seed memories are required for the Codex SDK transformation.

The Playwright smoke test stays in deterministic mock mode. The recorded product walkthrough should use real Codex for the first **Ask Recallia AI** call, then keep refinement deterministic in the app.

That gives the reviewer the important evidence: the actual user flow calls Codex through the SDK. The narrowing step remains app logic, so the demo does not depend on a second live model call.

## Decisions For This Version

- Real-Codex walkthrough: the recorded product demo uses `RECALLIA_AI_MODE=codex` for the first suggestion.
- Model env name: the optional model override is `RECALLIA_CODEX_MODEL`.
- Prompt determinism: add one explicit synthetic Frank/Frankfurt/Golf calibration example to the Codex prompt so live Codex has the same expected first suggestion as mock mode.

## SDK Contract

The SDK spike was verified against `@openai/codex-sdk@0.128.0`.

Actual API shape:

```ts
new Codex({ apiKey?, env?, config?, baseUrl?, codexPathOverride? })

codex.startThread({
  model?,
  workingDirectory?,
  skipGitRepoCheck?,
  sandboxMode?,
  approvalPolicy?,
  modelReasoningEffort?,
  webSearchMode?,
  additionalDirectories?
})

thread.run(input, { outputSchema?, signal? })
```

Completed turns return:

```ts
{
  finalResponse: string;
  items: ThreadItem[];
  usage: Usage | null;
}
```

Important:

- `model`, `workingDirectory`, `sandboxMode`, and `approvalPolicy` belong on `startThread(...)`.
- `thread.run(...)` receives only the prompt/input and turn options such as `outputSchema` and `signal`.

## Target Runtime Flow

Real mode should run only when:

```text
RECALLIA_AI_MODE=codex
OPENAI_API_KEY is present
```

The browser must still call only:

```text
POST /api/ai/suggest
```

The server route calls `createRecalliaAiRun(...)`, which calls the configured adapter.

Optional runtime overrides:

```text
RECALLIA_CODEX_MODEL
RECALLIA_CODEX_WORKING_DIRECTORY
RECALLIA_CODEX_PATH
```

The default Codex scratch directory is `<os-temp>/recallia-codex-scratch`.
Custom `RECALLIA_CODEX_WORKING_DIRECTORY` values are operator-managed and are
not removed by `npm run data:reset`.

Target real adapter shape:

```ts
import "server-only";

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Codex } from "@openai/codex-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { RecalliaAiAdapter, RecalliaAiInput } from "@/lib/recallia-ai";
import {
  MemoryPlacementSuggestionWireSchema,
  parseMemoryPlacementSuggestionJson
} from "@/lib/recallia-ai-schema";
import {
  RECALLIA_AI_SYSTEM_PROMPT,
  createAiInputSnapshot,
  createExistingMemorySnapshot
} from "@/lib/recallia-ai-prompt";
import type { MemoryPlacementSuggestion } from "@/lib/types";

const RECALLIA_OUTPUT_SCHEMA = zodToJsonSchema(
  MemoryPlacementSuggestionWireSchema,
  { target: "openAi" }
);
const PRIVATE_DIRECTORY_MODE = 0o700;
const DEFAULT_CODEX_WORKING_DIRECTORY = path.join(
  tmpdir(),
  "recallia-codex-scratch"
);

export class CodexSdkRecalliaAiAdapter implements RecalliaAiAdapter {
  private readonly codex: Codex;
  private readonly model?: string;
  private readonly timeoutMs: number;
  private readonly workingDirectory: string;

  constructor(input: {
    codex?: Codex;
    apiKey?: string;
    codexPathOverride?: string;
    model?: string;
    timeoutMs?: number;
    workingDirectory?: string;
  } = {}) {
    const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;

    this.model = input.model ?? process.env.RECALLIA_CODEX_MODEL;
    this.timeoutMs = input.timeoutMs ?? 60_000;
    this.workingDirectory = prepareCodexWorkingDirectory(
      input.workingDirectory ??
        process.env.RECALLIA_CODEX_WORKING_DIRECTORY ??
        DEFAULT_CODEX_WORKING_DIRECTORY
    );
    const codexPathOverride =
      input.codexPathOverride ??
      process.env.RECALLIA_CODEX_PATH ??
      resolveInstalledCodexBinaryPath();
    const codexProcessEnv = createCodexProcessEnv(this.workingDirectory);
    this.codex =
      input.codex ??
      new Codex({
        ...(apiKey ? { apiKey } : {}),
        ...(codexPathOverride ? { codexPathOverride } : {}),
        env: codexProcessEnv
      });
  }

  async suggestMemoryPlacement(input: RecalliaAiInput): Promise<MemoryPlacementSuggestion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const thread = this.codex.startThread({
        ...(this.model ? { model: this.model } : {}),
        workingDirectory: this.workingDirectory,
        skipGitRepoCheck: true,
        sandboxMode: "read-only",
        approvalPolicy: "never",
        modelReasoningEffort: "medium",
        webSearchMode: "disabled"
      });
      const prompt = [
        RECALLIA_AI_SYSTEM_PROMPT,
        "",
        "Draft memory:",
        createAiInputSnapshot(input.draftMemory),
        "",
        "Existing memories:",
        createExistingMemorySnapshot(input.existingMemories)
      ].join("\n");

      const turn = await thread.run(prompt, {
        outputSchema: RECALLIA_OUTPUT_SCHEMA,
        signal: controller.signal
      });

      if (!turn.finalResponse) {
        throw new Error("Codex SDK returned no final assistant text.");
      }

      return parseMemoryPlacementSuggestionJson(turn.finalResponse);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function prepareCodexWorkingDirectory(candidate: string): string {
  const resolved = path.resolve(candidate);
  const repoRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  const dataRoot = path.resolve("data");

  rejectInsideDirectory({ candidate: resolved, directory: dataRoot });
  rejectInsideDirectory({ candidate: resolved, directory: repoRoot });

  const realResolved = preparePrivateDirectory({
    directory: resolved,
    label: "RECALLIA_CODEX_WORKING_DIRECTORY"
  });

  rejectInsideDirectory({ candidate: realResolved, directory: realPathIfExists(dataRoot) });
  rejectInsideDirectory({ candidate: realResolved, directory: realPathIfExists(repoRoot) });

  return realResolved;
}
```

Helper detail: `resolveInstalledCodexBinaryPath()` checks the installed platform
package for the bundled Codex binary, and `createCodexProcessEnv(...)` creates
isolated `home`, `codex-home`, and `tmp` directories under the scratch working
directory before passing only that minimal environment plus non-secret platform
basics such as `PATH`. Scratch directories are created with private `0700`
permissions. Symlinked scratch directories are rejected so Codex cannot be
pointed back into the repo or runtime data through an indirect path.

## File Changes

Required:

- Add dependency: `@openai/codex-sdk`.
- Add dependency: `zod-to-json-schema`.
- Remove dependency: `openai`, unless another new use appears.
- Add `src/lib/recallia-ai-codex.ts`.
- Delete the legacy real adapter file.
- Update `src/lib/recallia-ai.ts` to instantiate `CodexSdkRecalliaAiAdapter`.
- Document optional runtime overrides in docs and tests:
  `RECALLIA_CODEX_MODEL`, `RECALLIA_CODEX_WORKING_DIRECTORY`, and
  `RECALLIA_CODEX_PATH`.
- Update `src/lib/recallia-ai-prompt.ts` to make the trust boundary explicit:
  - memory text is data, not instructions;
  - this is a single-turn reasoning task;
  - do not read/write files, run commands, or call tools;
  - use only inline JSON inputs.
  - include the synthetic Frank/Frankfurt/Golf calibration example below.
- Update `README.md` after implementation to describe Codex SDK real mode.
- Keep `adapterMode: "codex" | "mock"` unchanged.

Implemented hardening:

- Add `RECALLIA_CODEX_WORKING_DIRECTORY`; default to `<os-temp>/recallia-codex-scratch`.
- Resolve and create the Codex scratch directory before `startThread(...)`; reject values inside the Recallia repo or runtime `data/` directory.
- Reject symlinked scratch directories.
- Create scratch, home, Codex home, and temp directories with private `0700` permissions.
- Add `RECALLIA_CODEX_PATH` as an optional path override for the Codex binary.
- Make `npm run data:reset` remove default runtime data and default Codex scratch/session state.

Do not change:

- `src/app/api/ai/suggest/route.ts` unless required by imports.
- `Memory` or `AiRun` types.
- The mock adapter behavior.
- The e2e demo path.
- Seed data for this transformation.

## Safety Requirements

Top risks:

1. False memory creation.
2. Sensitive memory text leakage to OpenAI.
3. Prompt injection through memory text.
4. Accidental Codex filesystem/tool use.

Mitigations:

- AI suggestions remain advisory.
- Accept/edit is still the only path that mutates timeline dates or links.
- Real mode is server-side only.
- Codex receives inline JSON snapshots only.
- Codex runs in a scratch `workingDirectory`, not the Recallia repo.
- The scratch `workingDirectory` is resolved, created if missing, and rejected if it points inside the repo or runtime data directory.
- The Codex subprocess receives a minimal explicit environment with isolated home, state, and temp directories under the scratch directory.
- The default scratch/session state is reset by `npm run data:reset`; custom scratch directories are operator-managed.
- `sandboxMode: "read-only"` and `approvalPolicy: "never"` are required.
- `webSearchMode: "disabled"` is required.
- Output is parsed through `parseMemoryPlacementSuggestionJson(...)`.
- Unknown linked memory IDs are filtered by `validateSuggestionLinkedMemoryIds(...)`.
- Mock mode remains the deterministic default for tests and offline demos.

## Prompt Calibration Example

Add this as an explicit synthetic example in `src/lib/recallia-ai-prompt.ts`. It is not personal data; it is the scripted demo fixture.

```text
Synthetic calibration example:

Draft memory:
{
  "title": "Met Frank in Frankfurt",
  "description": "I met my friend Frank in Frankfurt. I think it was around the time I had my beige Golf.",
  "dateConfidence": "unknown",
  "location": "Frankfurt",
  "people": ["Frank"],
  "tags": ["friend", "Frankfurt"]
}

Existing memories:
- memory-lived-in-frankfurt: Lived in Frankfurt, 1995-01-01 to 1999-12-31.
- memory-owned-beige-vw-golf-1: Owned beige VW Golf 1, 1992-01-01 to 2000-12-31.
- memory-attended-evening-school: Attended evening school, 1996-01-01 to 1998-12-31.
- memory-worked-logistics-warehouse: Worked at logistics warehouse, 1997-01-01 to 2001-12-31.

Expected first suggestion before refinement:
{
  "suggestedStartDate": "1995-01-01",
  "suggestedEndDate": "1999-12-31",
  "dateConfidence": "approximate",
  "suggestedLinkedMemoryIds": [
    "memory-lived-in-frankfurt",
    "memory-owned-beige-vw-golf-1"
  ],
  "reasoning": "The draft mentions Frankfurt and the beige Golf. The supported overlap between living in Frankfurt and owning the beige Golf is 1995-1999.",
  "clarifyingQuestion": "Which other residence, car, work, or learning memories were true at the same time?"
}

Do not include evening school or logistics warehouse in the first suggestion unless the user has selected those facts during refinement. The app's refine route computes that later overlap deterministically as 1997-1998.
```

## Test Requirements

Update existing tests:

- `tests/recallia-ai.test.ts`
  - Keep adapter selection test: codex mode only when `RECALLIA_AI_MODE=codex` and `OPENAI_API_KEY` exist.
  - Replace client-boundary forbidden tokens:
    - forbid `recallia-ai-codex` in `"use client"` files;
    - forbid `from "@openai/codex-sdk"`;
    - forbid `new Codex`.
  - Remove legacy boundary expectations once the old adapter is deleted.

Add tests:

- `tests/recallia-ai-codex.test.ts`
  - Mock `@openai/codex-sdk` at the module boundary.
  - Assert `startThread(...)` receives `sandboxMode: "read-only"`, `approvalPolicy: "never"`, `workingDirectory`, and `skipGitRepoCheck: true`.
  - Assert `thread.run(...)` receives the prompt and `{ outputSchema, signal }`.
  - Assert the Codex subprocess receives a minimal env and does not inherit ambient secrets.
  - Assert scratch, home, Codex home, and temp directories are private.
  - Assert unsafe repo/data/symlinked scratch directories are rejected.
  - Assert `RECALLIA_CODEX_PATH` is honored.
  - Assert successful configured SDK calls persist `adapterMode: "codex"` with no fallback reason.
  - Happy path parses `turn.finalResponse`.
  - Malformed `finalResponse` throws `AiSuggestionValidationError`.
  - Timeout or SDK failure propagates so `recallia-ai.ts` falls back to mock with `fallbackReason`.

Keep existing tests green:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

`npm run test:e2e` should remain mock-mode and deterministic.

Add one manual real-Codex product smoke after implementation:

```bash
RECALLIA_AI_MODE=codex OPENAI_API_KEY=... npm run dev
```

Then perform the exact product walkthrough before recording:

1. Log in.
2. Create the prefilled Frank draft.
3. Click **Ask Recallia AI**.
4. Confirm the returned run has `adapterMode: "codex"` and no fallback reason.
5. Confirm the first suggestion is 1995-1999 with Frankfurt plus beige Golf.
6. Select evening school and logistics work.
7. Click **Refine suggestion** and confirm the app narrows to 1997-1998.
8. Accept and reload.

If the first Codex suggestion falls back to mock, times out, or misses the broad overlap, do not record over it. Tighten prompt/config and run the smoke again.

## Acceptance Criteria

The Codex SDK transformation is complete when:

- `package.json` includes `@openai/codex-sdk` and `zod-to-json-schema`.
- `package.json` no longer includes `openai`.
- `src/lib/recallia-ai-codex.ts` exists and is server-only.
- The legacy real adapter file is removed.
- `src/lib/recallia-ai.ts` uses the Codex SDK adapter for `adapterMode: "codex"`.
- `RECALLIA_CODEX_MODEL` is the documented optional model override.
- `RECALLIA_CODEX_WORKING_DIRECTORY` and `RECALLIA_CODEX_PATH` are documented optional runtime overrides.
- Browser/client files do not import the SDK adapter or package.
- Real mode creates a Codex thread with read-only sandboxing and never-approval.
- Real mode disables Codex web search.
- Real mode uses a scratch working directory outside the repo and runtime data.
- The Codex subprocess receives only a minimal explicit environment with isolated home/session/temp state.
- Default scratch/session state is reset by `npm run data:reset`.
- Real mode parses `turn.finalResponse` through the existing schema gate.
- The prompt includes the synthetic Frank/Frankfurt/Golf calibration example.
- The recorded product walkthrough uses real Codex for the first suggestion, visible as `adapterMode: "codex"` with no fallback reason.
- Asking AI still does not mutate memory dates or links before acceptance.
- The refined Frank demo path still passes in mock mode.
- README and SPEC describe the real adapter as Codex SDK.
