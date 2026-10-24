# FleetPulse + Incident Copilot

Documentación base para implementar el challenge usando **Spec-Driven
Development (SDD)**.

> Convención: código, nombres de archivos, endpoints, tipos y campos de
> API permanecen en inglés. La explicación de arquitectura y decisiones
> está en español para facilitar la preparación de la explicación.

## Orden de autoridad

Si existe una contradicción:

1.  Challenge oficial, fixtures y outputs esperados.
2.  `docs/SPECIFICATION.md`.
3.  `docs/API-CONTRACTS.md`.
4.  `docs/ARCHITECTURE.md`.
5.  `docs/IMPLEMENTATION-PLAN.md`.
6.  Implementación existente.

No modificar una especificación silenciosamente para hacer que coincida
con el código.

## Stack acordado

- pnpm monorepo
- Express + TypeScript
- PostgreSQL + raw `pg`
- SQL migrations
- Zod
- Angular CSR + Signals/RxJS
- REST + SSE
- in-process event bus
- PostgreSQL Full Text Search
- `AnswerGenerator` agnóstico con Gemini preferido si hay API key
- generación extractiva determinista sin credenciales como fallback
- Vitest + PostgreSQL real para integración
- Playwright solo si aporta valor y hay tiempo
- OpenAPI 3 + Swagger UI para explorar la API
- Docker Compose
- logging sanitizado (Pino opcional)
- ESLint + Prettier
- GitHub Actions

## Documentos

- `AGENTS.md`: reglas para agentes de código.
- `docs/ARCHITECTURE.md`: decisiones y tradeoffs.
- `docs/SPECIFICATION.md`: comportamiento autoritativo del producto.
- `docs/API-CONTRACTS.md`: contratos REST/SSE/RAG.
- `docs/IMPLEMENTATION-PLAN.md`: orden de construcción.
- `docs/TESTING.md`: estrategia mínima de pruebas.
- `docs/RAG-SECURITY.md`: seguridad del Copilot.
- `docs/RAG-EVALUATION.md`: plantilla de resultados verificables de
  los seis casos; completar durante la implementación.
- `docs/AI-WORKFLOW.md`: evidencia real del uso de agentes.
- `docs/RETROSPECTIVA.md`: completar al final.

## Flujo SDD

```text
challenge
   ↓
specification
   ↓
architecture
   ↓
implementation task
   ↓
tests
   ↓
human verification
```

## Inicio local esperado

Cuando exista la implementación, el repositorio debe converger a una
experiencia similar a:

```bash
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm knowledge:index
pnpm dev
```

Y, en otra terminal:

```bash
pnpm replay
```

Los nombres finales de scripts deben mantenerse simples y documentados
aquí.

Esta carpeta contiene documentación de preparación, no la aplicación.
Antes de entregar habrá que ejecutar los dos replays, pruebas, CI y demo;
publicar con tag `entrega-final` y video de 8–12 minutos enlazado aquí.
