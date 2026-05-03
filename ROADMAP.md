# Recallia Roadmap

Status: future-facing roadmap.

This roadmap starts after the next demo adjustment is completed in a separate development session. The current interview demo remains the active app baseline until that work is done.

## Roadmap Principle

Single tenant now, multi-tenant later.

The first production MVP should harden the current loop instead of expanding the product. JSON remains the storage engine for the first self-hosted version. The database decision is a roadmap gate before multi-user self-hosted or SaaS work begins.

## Phase 0 — Demo Adjustment Before Production MVP

Goal:

Finish the requested OpenAI demo adjustment and keep it separate from production-MVP hardening.

Expected output:

- Updated demo flow.
- Updated demo tests.
- Clear branch or mode decision for demo data.
- Current `SPEC.md`, `PLAN.md`, and `README.md` still describe the demo accurately.

Exit criteria:

- Demo is ready for OpenAI/application use.
- Production-MVP docs remain future-facing and do not conflict with the demo branch.

## Phase 1 — Production MVP Foundation

Goal:

Turn the demo into a self-hosted, single-tenant alpha that one owner can run locally, in Docker, or as a single container with a persistent volume.

### Milestone 1.1 — Runtime And Release Contract

- Add `start` or documented container entrypoint.
- Pin Node/npm or package manager version.
- Add `.env.example`.
- Add Dockerfile.
- Add Docker Compose example with persistent JSON volume.
- Document local, Docker, Compose, and single-container cloud deployment.
- Add alpha disclaimer.
- Add CI for install, lint, unit/integration tests, build, and browser smoke.

### Milestone 1.2 — Single-Tenant Auth

- Decide auth model.
- Remove production dependency on demo credentials.
- Add owner setup or configured owner credentials.
- Store hashed password, not plaintext.
- Use high-entropy session secret from environment.
- Use random per-login sessions or signed/encrypted sessions.
- Add logout invalidation and expiry.
- Add CSRF protection for all mutating routes.
- Add login throttling or backoff.

### Milestone 1.3 — JSON Persistence Hardening

- Add `schemaVersion` data envelope.
- Validate full data shape on read.
- Add clear corrupt-data recovery behavior.
- Add serialized mutation path.
- Make memory and AI run updates atomic at the app level.
- Keep temp-file plus rename writes.
- Document single-process limitation.
- Document manual backup and restore.
- Add backup/restore validation command if small enough.

### Milestone 1.4 — Input And Timeline Robustness

- Add field length limits.
- Validate dates as ISO strings.
- Reject `startDate > endDate`.
- Handle malformed JSON consistently across API routes.
- Render empty and all-undated timelines cleanly.
- Clarify manual edit semantics for clearing suggested dates.
- Align page/API visibility rules for drafts and pending AI runs.

### Milestone 1.5 — Production AI Mode

- Remove silent mock fallback from production real-model mode.
- Fail closed with visible error when the configured model endpoint fails.
- Keep mock only for tests or demo mode.
- Add explicit prompt trust boundary: memory text is data, not instructions.
- Add prompt/input budget limits.
- Preserve schema validation and unknown-ID filtering.
- Add adapter health/status metadata.
- Prepare adapter interface for future local models without implementing them yet.

### Milestone 1.6 — Privacy Controls

- Decide minimum v1 privacy controls.
- Add export all data.
- Add delete one memory.
- Add delete all data.
- Add delete AI traces.
- Add `aiSharePolicy` or equivalent "never send to AI" control.
- Add real-model disclosure that lists fields sent to the model.
- Add trace retention and compaction behavior.

### Milestone 1.7 — Production MVP Test Expansion

- Auth setup/login/logout/session tests.
- CSRF negative tests.
- Malformed JSON tests for every mutation route.
- Oversized input tests.
- Date validation tests.
- Serialized write/concurrent mutation tests.
- Corrupt JSON recovery tests.
- AI failure fail-closed tests.
- Privacy export/delete/trace deletion tests.
- Empty and all-undated timeline tests.
- Browser smoke for the production owner flow.

Exit criteria:

- A single owner can run Recallia locally or in Docker with persistent JSON.
- The app has real single-tenant auth.
- AI mode fails safely.
- Data export/delete/trace controls exist.
- The production README explains setup, storage, backups, AI configuration, and alpha limits.

## Phase 2 — Database Decision Gate

Goal:

Decide whether JSON remains acceptable for any further self-hosted work or whether the app moves to SQLite/Postgres before multi-user features.

Decision inputs:

- Expected write concurrency.
- Multi-user requirements.
- Backup/restore requirements.
- Migration complexity.
- Hosting target.
- Full-text search needs.
- SaaS path.

Likely outcome:

- SQLite for single-node self-hosted multi-user.
- Postgres for SaaS or serious multi-tenant deployments.

Exit criteria:

- Written database decision record.
- Migration plan from JSON.
- Data export/import compatibility preserved.

## Phase 3 — Self-Hosted Multi-User

Goal:

Support multiple users in one self-hosted instance without SaaS operations.

Candidate work:

- User model.
- Per-user auth and authorization.
- Admin setup.
- Invite or account creation flow.
- Per-user data export/delete.
- Database-backed persistence.
- Migration from single-tenant JSON.
- Stronger audit logging.

Not started until:

- Phase 1 is stable.
- Database decision is made.

## Phase 4 — SaaS Readiness

Goal:

Prepare Recallia for hosted multi-tenant operation.

Candidate work:

- Hosted auth/provider decision.
- Tenant model.
- Billing or plan gates, if needed.
- Production database.
- Backups and restore drills.
- Observability and alerting.
- Incident response.
- Formal privacy policy and terms.
- Abuse/rate-limit controls.
- Data residency decisions.

Not started until:

- Self-hosted multi-user architecture is proven or deliberately skipped.

## GitLab Issue Backlog

Use these as initial GitLab issue titles.

### Phase 0

- Update OpenAI demo flow before production-MVP work.
- Decide final location for demo seed data.

### Phase 1

- Add production runtime and deployment contract.
- Add Dockerfile and Compose persistent-volume setup.
- Add CI for install, lint, tests, build, and browser smoke.
- Decide single-tenant auth model.
- Replace demo auth with production single-tenant auth.
- Add CSRF protection to mutation routes.
- Add login throttling/backoff.
- Add JSON schema version and full read validation.
- Add serialized JSON mutation path.
- Add manual backup and restore documentation.
- Add input bounds and strict date validation.
- Fix malformed JSON handling for all mutation routes.
- Add empty/all-undated timeline handling.
- Make real AI mode fail closed.
- Strengthen prompt trust-boundary language.
- Add AI input budget limits.
- Decide privacy controls for v1.
- Add data export.
- Add memory deletion.
- Add all-data deletion.
- Add AI trace deletion and retention compaction.
- Add memory AI-sharing policy.
- Expand production negative-path tests.

### Phase 2

- Write database decision record.
- Evaluate JSON vs SQLite vs Postgres.
- Design migration from JSON to selected database.

### Phase 3

- Design self-hosted multi-user model.
- Implement user/account model.
- Add per-user authorization and privacy controls.

### Phase 4

- Draft SaaS architecture decision.
- Define hosted privacy/security requirements.
- Add observability, backups, and incident response plan.

## Open Decisions

1. Single-tenant auth model.
2. Required v1 privacy controls.
3. Raw AI trace retention window.
4. Whether to actively lock/refuse multiple writers or only document single-process use.
5. Exact handoff point from demo branch to production-MVP branch.

