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

## Final retrospective points

Al terminar, resumir:

- dónde aceleró AI;
- qué decisiones fueron humanas;
- qué error(es) detectó revisión humana;
- cómo SDD/tests evitaron desviaciones.
