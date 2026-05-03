# Recallia Production MVP Spec

Status: future-facing planning document.

This spec describes the first production MVP after the current OpenAI demo path is adjusted in a separate development session. It does not replace the current demo `SPEC.md` until that demo work is complete and the production MVP milestone starts.

## Product Summary

Recallia is a self-hosted personal memory system that helps one owner capture life memories, place uncertain memories on a timeline, and use AI to suggest dates and relationships without silently changing user data.

The first production MVP is intentionally narrow:

- Single-tenant and self-hosted.
- JSON-backed persistence.
- One owner account.
- One hardened memory-to-AI-to-confirmation loop.
- Manual backup documentation.
- Database choice deferred to the roadmap before multi-user or SaaS work.

## Non-Goals For This MVP

- Multi-user accounts.
- SaaS hosting.
- Team sharing or social features.
- Uploads.
- Graph canvas.
- Search beyond what is needed for the existing timeline.
- Database migration away from JSON.
- Local model support, except as a future adapter direction.

## Deployment Targets

The production MVP must support:

- Local Node.js app on a personal machine.
- Docker container.
- Docker Compose with a persistent volume.
- Single-container deployment on a cloud host, with an alpha disclaimer and persistent storage requirements.

The app must clearly document that this MVP is single-process. Running multiple app instances against the same JSON file is unsupported until a database decision is made.

## Product Flow

The core product loop remains:

1. Owner signs in.
2. Owner views their timeline.
3. Owner adds an uncertain memory.
4. Owner asks Recallia AI for placement and linked-memory suggestions.
5. Recallia shows advisory suggestions, reasoning, and trace metadata.
6. Owner refines, accepts, edits, or rejects.
7. Only accepted or edited suggestions mutate timeline dates and links.
8. Memory and AI run metadata persist.

The production default should not depend on the Frank/Frankfurt/Golf seed data. Demo data should move to a separate demo path or branch after the next demo adjustment.

## Authentication

Decision status: open.

The first production MVP needs real single-tenant auth, not demo auth. The implementation should be minimal but not trivially forgeable.

Required:

- No hardcoded demo credentials in production mode.
- No static reusable session cookie value.
- Passwords are never stored in plaintext.
- Session secret comes from environment configuration.
- Session cookies use `httpOnly`, `secure` in production, and `sameSite=lax` or stricter.
- Logout invalidates the active session.
- Mutating routes have CSRF protection beyond relying on `SameSite`.
- Login has basic abuse protection such as throttling or lockout/backoff.

Candidate auth models to decide:

- One configured admin user via environment variables.
- First-run setup screen that creates the owner account.
- Local passphrase mode for fully local/airgapped use.

Recommendation for first production MVP:

Use a first-run setup flow or configured admin credentials that create a hashed password record in the JSON data file. Use a high-entropy session secret from the environment and random per-login sessions. This avoids checked-in secrets while keeping the app self-hosted and simple.

## Persistence

The first production MVP keeps JSON storage.

Required:

- Data file path configurable via environment variable.
- Docker/Compose examples use a persistent volume.
- JSON file uses a versioned envelope:

```ts
type RecalliaData = {
  schemaVersion: number;
  owner: OwnerAccount;
  memories: Memory[];
  aiRuns: AiRun[];
  settings: AppSettings;
};
```

- Reads validate the full stored shape, not only top-level arrays.
- Invalid or corrupt data fails with a clear recovery path.
- Writes are serialized through a single mutation path.
- Multi-step mutations, such as accepting an AI run and updating a memory, are written atomically from the application perspective.
- Writes still use temp-file plus rename.
- Manual backup is documented.
- Database evaluation is deferred until before self-hosted multi-user work.

Unsupported:

- Multiple app instances writing the same JSON file.
- Shared network storage without explicit locking guarantees.

## Memory Model

Production `Memory` should keep the current core shape and add AI-sharing controls.

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
  aiSharePolicy: "allow" | "exclude";
  createdAt: string;
  updatedAt: string;
};
```

Validation requirements:

- Bounded title, description, location, people, tags, and linked-memory arrays.
- ISO date validation where dates are present.
- `startDate <= endDate` where both dates are present.
- Empty and all-undated timelines render cleanly.

## AI Behavior

Production mode must fail closed.

Required:

- Browser calls only server-side Recallia AI routes.
- OpenAI or future model adapters run server-side only.
- Runtime model selection is configured by environment.
- OpenAI failure returns a visible error.
- Production real-model mode does not silently fall back to mock.
- Mock mode may remain for tests or the demo branch, but should not be a production runtime fallback after the OpenAI demo is complete.
- AI suggestions never mutate timeline data before owner acceptance.
- AI output is schema-validated.
- Unknown linked memory IDs are rejected or ignored safely.
- Memory text is treated as untrusted prompt input.
- Prompt explicitly says memory text is data, not instructions.

Future model direction:

- OpenAI is the first real adapter.
- Local model adapters may be added later for airgapped self-hosted use.
- Adapter choice must remain server-side and traceable.

## AI Trace Retention

Decision status: partially decided.

The production MVP should keep full raw AI traces temporarily, then retain only minimal metadata unless the owner opts into longer raw trace retention.

Required:

- Store adapter mode, created timestamp, status, suggested date range, linked IDs, and validation warnings.
- Keep raw prompt/input/output trace for a configurable short retention window.
- After the retention window, allow trace compaction to minimal metadata.
- Owner can opt into retaining raw traces longer.
- Owner can delete AI traces.

Open question:

- Exact default retention window.

## Privacy Controls

Decision status: open.

Minimum recommended production MVP controls:

- Export all data.
- Delete one memory.
- Delete all data.
- Delete AI traces.
- Mark memory as "never send to AI" through `aiSharePolicy`.

AI sharing disclosure:

- Environment configuration is enough to enable a model adapter.
- The UI must still clearly show when a real external model is configured.
- Before sending memory text, the AI flow must disclose what fields are sent.
- Memories marked `aiSharePolicy: "exclude"` are not sent to external model adapters.

## Backup And Recovery

The first production MVP uses documented manual backups.

Required:

- README documents the JSON file path.
- README documents how to stop the app before copying the JSON file.
- README documents restore steps.
- App or CLI provides a validation command before and after restore.

Not required in the first production MVP:

- Scheduled backups.
- Backup UI.
- Cloud backup integration.

## Demo Mode

The current Frank/Frankfurt/Golf demo flow remains part of the OpenAI application/demo work until the next demo adjustment is complete.

After that:

- Demo seed data should not be production default data.
- Demo data should live in a separate demo branch, demo mode, or explicit seed command.
- Production first-run should start with an empty or owner-controlled timeline.

## Tests

Production MVP tests must cover:

- Auth setup/login/logout/session expiry.
- CSRF rejection for mutating routes.
- Malformed JSON returns controlled 400s.
- Input bounds and date validation.
- JSON schema validation and corrupt-data recovery path.
- Serialized JSON mutations.
- Accepting AI suggestions writes memory and AI run consistently.
- AI failure in real mode fails closed.
- Prompt-injection-like memory text cannot force unknown linked IDs.
- Export/delete/trace deletion privacy controls.
- Empty and all-undated timeline rendering.
- Docker/Compose smoke path, if feasible in CI.

## Release Requirements

Required:

- `npm ci`.
- `npm test`.
- `npm run lint`.
- `npm run build`.
- Browser smoke test.
- CI pipeline for the above.
- `start` script or documented container entrypoint.
- Node/package manager version pin.
- `.env.example` without real secrets.
- Dockerfile.
- Docker Compose example with persistent volume.
- Production README section with alpha disclaimer.

## Open Questions

1. Which single-tenant auth model should be chosen: configured admin, first-run setup, or passphrase mode?
2. What is the default raw AI trace retention window?
3. Which privacy controls are must-have for the very first production MVP versus shortly after?
4. Should the production MVP actively refuse to start if it detects another process holding the JSON file?
5. Should local model support be considered in the first production MVP, or only after OpenAI production mode is stable?

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
