# AI-Assisted Development Workflow

Este documento se completa **durante** la implementación con evidencia
real.

## Workflow

```text
human chooses scoped task
→ agent reads spec
→ agent implements
→ agent runs checks
→ human reviews invariants
→ correction if needed
→ accept
```

## Session template

\### Session N ---

```{=html}
<task>
```

**Goal**

...

**Prompt**

...

**Files changed**

- ...

**Agent verification**

...

**Human verification**

...

**Mistake/correction**

Registrar únicamente errores reales. No fabricar evidencia.

**Outcome**

Accepted / revised / rejected.

## Session 1 — Database foundation

**Goal**

Implement Phase 1 SQL migrations, a runner, and a local reset command.

**Prompt**

Implement Phase 1 following the authoritative specification and database
architecture. Keep PostgreSQL constraints for domain boundaries and verify
migrations locally.

**Files changed**

- `database/migrations/001_initial_schema.sql`
- `database/migrate.ts`
- `database/package.json`
- root scripts and database documentation

**Agent verification**

JSON/YAML configuration and the migration's required schema elements were
checked before local execution.

**Human verification**

`pnpm db:migrate` exposed that PostgreSQL does not provide
`isfinite(double precision)`. `pnpm typecheck` exposed that the migration
runner was being interpreted as CommonJS. After correction, the first
`pnpm db:migrate` applied `001_initial_schema.sql`; the second completed
without applying it. `pnpm typecheck`, `pnpm lint`, and
`pnpm format:check` passed.

**Mistake/correction**

The initial migration incorrectly used `isfinite` for floating-point
columns. The range comparisons already reject `NaN` and infinity, so the
unsupported calls were removed. A local `database/package.json` with
`"type": "module"` was added so TypeScript permits `import.meta.url`.

**Outcome**

Accepted.

## Session 2 — Telemetry ingestion

**Goal**

Implement authenticated, per-event telemetry ingestion with idempotency and
overspeed alerts.

**Prompt**

Implement only Phase 2 backend ingestion following the API contract. Keep
transactions per event and do not add query, realtime, or frontend routes.

**Files changed**

- `backend/src/app.ts`
- `backend/src/index.ts`
- `backend/src/telemetry.ts`
- `backend/src/telemetry-repository.ts`
- backend and root package scripts

**Agent verification**

`pnpm typecheck` passed. Formatting was applied and verified.

**Human verification**

`pnpm lint` found an unused fourth argument in Express error middleware.
The initial integration-test run then found an untyped JSON body and a
server-start hook that subscribed after the server was already listening.

**Mistake/correction**

Express uses a four-argument function to identify error middleware. The
required `next` argument is now explicitly marked as intentionally unused,
so the middleware keeps its required signature and satisfies linting. The
test now starts its server inside `beforeAll` and types its JSON response
before reading batch counters.

**Outcome**

Accepted. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and all six
integration tests passed after the correction.

## Session 3 — Fleet query API

**Goal**

Expose current vehicle state, vehicle history, alerts, health, and API
documentation without adding mutable state for vehicles.

**Prompt**

Implement Phase 3 query endpoints with deterministic ordering. Derive current
state from `observedAt` and `eventId`; preserve the existing ingestion API.

**Files changed**

- `backend/src/telemetry-repository.ts`
- `backend/src/app.ts`
- `backend/src/openapi.ts`
- integration tests and API documentation

**Agent verification**

Query behavior was covered with integration tests for latest state, ordered
history, historical alerts, and health.

**Human verification**

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and all nine integration
tests passed.

**Mistake/correction**

No correction was required in this session.

**Outcome**

Accepted.

## Session 4 — Controlled replay

**Goal**

Replay the 24 official events progressively, with controls and observable
results, against the authenticated API.

**Prompt**

Implement the replay CLI without sorting fixture events. Provide start, pause,
resume, restart, status, and safe API-key handling from environment variables.

**Files changed**

- `replay/src/index.ts`
- `replay/src/replay.ts`
- `replay/src/replay.test.ts`
- replay command and README instructions

**Agent verification**

Automated tests cover JSONL input order and controller accounting. The
integration suite verifies both official replay oracles.

**Human verification**

The CLI paused at line 11 with no additional events entering. After resume,
the first run finished with 20 accepted, 2 duplicates, and 2 rejected. A
restart without database reset finished with 0 accepted, 22 duplicates, and
2 rejected.

**Mistake/correction**

TypeScript initially retained `INGEST_API_KEY` as optional inside the request
closure. The validated key was bound to a non-optional constant before use.

**Outcome**

Accepted. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and 12 tests
passed.

## Session 5 — Realtime stream

**Goal**

Publish committed telemetry changes to connected clients using SSE.

**Prompt**

Implement an in-process event bus and `/api/stream`. Publish only after the
per-event transaction commits; do not notify on duplicate, conflict, or
rejected input.

**Files changed**

- `backend/src/event-bus.ts`
- `backend/src/app.ts`
- `backend/src/telemetry-repository.ts`
- SSE integration tests and OpenAPI/README documentation

**Agent verification**

The SSE test opens a stream, verifies a committed current event emits
`vehicle.updated`, then verifies a late overspeed emits `alert.created`
without a `vehicle.updated` message.

**Human verification**

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and all 13 integration
tests passed.

**Mistake/correction**

No correction was required in this session.

**Outcome**

Accepted.

## Session 6 — Angular dashboard

**Goal**

Build a compact Angular dashboard with REST snapshots, live SSE updates,
vehicle search, alerts, and event history.

**Prompt**

Implement the required Angular CSR dashboard without maps or charts. Use the
local development proxy so the browser never receives the ingestion API key.

**Files changed**

- `frontend/` Angular application, proxy, and build configuration
- root scripts and dashboard documentation

**Agent verification**

Backend integration tests remained green after adding the frontend workspace.

**Human verification**

The initial frontend build found a missing `@angular/forms` dependency and an
Angular 22 requirement for TypeScript 6 while the workspace used TypeScript
5.9.

**Mistake/correction**

The frontend dependencies were incomplete and incompatible with Angular 22.
`@angular/forms` was added, and TypeScript and Vitest were aligned with the
Angular build requirements. Build and dashboard checks must be rerun.

**Outcome**

Accepted. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, 13 integration
tests, and the Angular production build passed. During the live replay, the
dashboard received SSE updates without a browser reload and showed the
official final state: 8 vehicles and 4 alerts.

## Session 7 — RAG retrieval and safe extractive answers

**Goal**

Index the supplied Markdown knowledge dynamically in PostgreSQL FTS and
answer support questions with observable retrieval, literal citations,
telemetry evidence when relevant, and safe abstention.

**Prompt**

Implement Phase 7 before adding an external LLM. Use PostgreSQL FTS,
preserve a retrieval trace, treat retrieved knowledge as data, and cover the
official support fixture plus hostile knowledge.

**Files changed**

- `database/migrations/002_knowledge_chunks.sql`
- `database/index-knowledge.ts`
- `backend/src/support-service.ts`
- support API, OpenAPI, integration tests, and RAG documentation

**Agent verification**

`pnpm knowledge:index` indexed five chunks from five knowledge files.
`pnpm test:integration` ran indexing and passed 16 tests, including correct
source retrieval, abstention, telemetry citation, and hostile-KB behavior.

**Human verification**

All six cases from `fixtures/support_questions.json` were sent to
`POST /api/support/ask`. S-01 through S-06 met their expected grounding and
source requirements. S-05 retrieved KB-99 only in the trace, cited KB-03,
and returned no secret.

**Mistake/correction**

The first hostile-KB test retrieved the hostile document but ranked unrelated
safe chunks above KB-03, so it could not provide the required security
guidance. The lexical query now expands security-sensitive wording with safe
policy terms. KB-99 remains trace-only and cannot be cited as authority.

**Outcome**

Accepted. La prueba de extensibilidad también añadió KB-05 sin cambiar
código, la recuperó con cita y, tras retirar el archivo y reindexar, obtuvo
abstención sin citas.

## Session 8 — Optional Gemini generator

**Goal**

Add a provider-agnostic Gemini adapter while retaining deterministic,
credential-free extractive answers.

**Prompt**

Implement an optional Gemini provider without changing application-owned
retrieval, citations, grounding, abstention, or the API contract. Keep tests
offline and preserve a fallback when the provider is unavailable.

**Files changed**

- `backend/src/answer-generator.ts`
- `backend/src/answer-generator.test.ts`
- backend startup/configuration and support-service wiring
- `.env.example`, README, and RAG security documentation

**Agent verification**

The provider adapter is tested with injected HTTP responses: it uses the
server-side Gemini Interactions endpoint, supplies no tools, sets
`store=false`, includes the event evidence identity, and falls back after a
provider failure. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
`pnpm test:integration` (18 tests), and the Angular production build passed.

**Human verification**

With `LLM_PROVIDER=gemini` and a personal key configured outside Git, the
support request for exactly 80 km/h returned a concise answer that correctly
said no alert is generated. It kept `grounded=true`, cited KB-01, preserved
the retrieval trace, and exposed no secret.

**Mistake/correction**

Strict TypeScript rejected an optional Gemini key passed as an explicit
`undefined`; the generator configuration now models that possibility. The
first mocked-provider test also revealed that the prompt had event facts but
not the `EVENT:<id>` label. The label is now included so provider input and
application citation identity agree.

**Outcome**

Accepted. The default remains extractive; Gemini is optional and retains the
same application-controlled evidence contract.

## Final retrospective points

Al terminar, resumir:

- dónde aceleró AI;
- qué decisiones fueron humanas;
- qué error(es) detectó revisión humana;
- cómo SDD/tests evitaron desviaciones.
