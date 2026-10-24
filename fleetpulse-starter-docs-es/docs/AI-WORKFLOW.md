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

## Final retrospective points

Al terminar, resumir:

- dónde aceleró AI;
- qué decisiones fueron humanas;
- qué error(es) detectó revisión humana;
- cómo SDD/tests evitaron desviaciones.
