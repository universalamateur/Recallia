# Recallia

![Recallia logo](logo.png)

Recallia is a personal memory system that helps you capture, structure, and connect your life experiences into a coherent timeline with AI-assisted recall.

The MVP is intentionally narrow: one user, one uncertain memory, one AI suggestion, one human confirmation, and one persisted result.

## Demo Flow

The MVP demonstrates one polished workflow:

1. A user logs in with local demo credentials.
2. The user views seeded memories on a timeline.
3. The user adds an uncertain memory.
4. The user clicks **Ask Recallia AI**.
5. A server-side OpenAI API route wrapper suggests a date range, linked memories, reasoning, and a clarifying question.
6. The user accepts, edits, or rejects the suggestion.
7. The accepted result is persisted and shown on the timeline with AI run history.

## Demo Credentials

```text
email: demo@recallia.local
password: recallia
```

## Target Stack

- Next.js + TypeScript.
- File-backed local JSON persistence.
- Server-side OpenAI Responses API route wrapper with mock fallback.
- Vitest for unit/integration tests.
- Playwright browser smoke test for the Loom path.

## Local Development

Implementation has not started yet. Machine-local launch prompts and submission notes live in `.local/`, which is intentionally gitignored.

## Project Docs

- [SPEC.md](SPEC.md): Source of truth for MVP requirements, data model, AI safety, and product non-goals.
- [AGENTS.md](AGENTS.md): Agent instructions and design principles.
- [PLAN.md](PLAN.md): Build sequence and acceptance checklist.

## Codex Integration

Codex/OpenAI integration requirements live in [SPEC.md](SPEC.md). The short version: use a server-side API route wrapper, keep a mock fallback, and never call the OpenAI API directly from the browser.

## Known MVP Limits

Product scope and non-goals live in [SPEC.md](SPEC.md) to avoid drift.
