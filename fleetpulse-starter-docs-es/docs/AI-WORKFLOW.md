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

## Final retrospective points

Al terminar, resumir:

- dónde aceleró AI;
- qué decisiones fueron humanas;
- qué error(es) detectó revisión humana;
- cómo SDD/tests evitaron desviaciones.
