# AGENTS.md

Recallia is an OpenAI Codex take-home demo app. Keep the implementation small, polished, and traceable.

## Design Principles

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing more to take away." — Antoine de Saint-Exupéry

Every decision passes three filters, in order:

1. **Understandability** — can someone unfamiliar with this understand it in 30 seconds?
2. **Maintainability** — will this be easy to change six months from now?
3. **Simplicity** — is this the least complexity that solves the problem?

These are filters, not aspirations. When in doubt, remove.

## Source Of Truth

- [SPEC.md](SPEC.md) is the product contract: MVP requirements, data model, demo story, AI safety, and non-goals.
- [README.md](README.md) is repo orientation and local usage.
- [PLAN.md](PLAN.md) is build order and acceptance criteria.

When files conflict, follow [SPEC.md](SPEC.md) for product behavior and this file for agent behavior.

## Mission

Build the first working iteration described in [SPEC.md](SPEC.md):

> Recallia is a personal memory system that helps users turn scattered life events into a connected timeline.

The demo must show one complete loop: login, seeded timeline, add uncertain memory, ask Recallia AI for placement/link suggestions, human confirmation, persistence, and tests.

## Stack Preference

Prefer Next.js + TypeScript for the app so the OpenAI API route wrapper can run server-side.

Use file-backed local JSON persistence for the MVP. Do not add SQLite, Prisma, or lowdb unless JSON proves insufficient.

## AI Safety And Traceability

Top risks:

- False memory creation.
- Sensitive personal data leakage.
- Opaque AI behavior.
- Prompt injection from memory text.

Required mitigations:

- AI suggests only; user confirms before changes affect the timeline.
- OpenAI input is scoped to the draft memory and existing memory summaries.
- Store AI run metadata: input snapshot, existing memory snapshot, response, status, adapter mode, created timestamp.
- Show an "AI trace" section in the UI, collapsed by default.
- Do not commit secrets, tokens, `.env`, private notes, or customer data.

## Implementation Rules

- Inspect existing files before editing.
- Build only the MVP in [SPEC.md](SPEC.md). Product non-goals live there; do not add them unless the spec changes.
- Keep the first vertical slice working before adding polish.
- Prefer boring, explicit code over clever abstractions.
- Add comments only where they explain a non-obvious decision.
- Use deterministic seed data so the Loom demo is repeatable.
- Tests should exercise behavior, not implementation details.
- Implement the real path as a server-side OpenAI Responses API wrapper when configured; keep deterministic mock fallback as the default.

## Demo Story

Use the demo story in [SPEC.md](SPEC.md) unchanged so the Loom walkthrough stays repeatable.
