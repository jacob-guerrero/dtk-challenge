# Plan de Implementación

La arquitectura está suficientemente definida. Después de este
documento, comenzar código.

## 0. Foundation

Crear:

- pnpm workspace;
- folders/packages;
- TypeScript configs;
- Docker Compose PostgreSQL;
- `.env.example`;
- Zod config validation;
- ESLint/Prettier;
- root scripts.

**Done:** install + DB startup + typecheck funcionan. Evitar herramientas
adicionales hasta tener el núcleo P0 comprobado.

## 1. Database

Crear SQL migrations:

- `telemetry_events`;
- `alerts`;
- indexes/constraints;
- migration runner;
- reset script para desarrollo.

**Done:** migrate/reset reproducibles.

## 2. Telemetry ingestion

Implementar:

- Zod event schema;
- API-key middleware;
- raw `pg` repository;
- per-event transaction;
- concurrency-safe identity resolution;
- overspeed;
- batch aggregation.

**Done:** must-have telemetry tests pasan.

## 3. Fleet APIs

Implementar:

- vehicles;
- vehicle history;
- alerts;
- health;
- OpenAPI/Swagger para consultar rutas, payloads y errores.

**Done:** fixture produce current states esperados.

## 4. Replay

Implementar CLI respetando orden del JSONL, pacing y controles
start/pause/resume/restart. Mostrar línea, progreso, conteos y motivos de
rechazo. La API key se toma de entorno y no se imprime.

**Done:** primer y segundo replay coinciden exactamente con oracle.

## 5. Realtime

Implementar:

- typed event bus;
- publish after commit;
- SSE endpoint;
- heartbeat;
- Angular reconnect/resync strategy.
- dos clientes SSE simultáneos.

**Done:** realtime invariants pasan.

## 6. Angular

UI mínima:

- fleet table/search;
- status/speed/last event;
- alerts;
- selected vehicle history;
- live updates.

No mapas/charts salvo tiempo sobrante.

**Done:** replay actualiza UI sin refresh.

## 7. RAG retrieval

Implementar:

- `knowledge:index`;
- Markdown chunking;
- PostgreSQL FTS;
- retrieval trace;
- citations;
- grounding/abstention;
- optional telemetry evidence.
- citas de evento/alerta cuando se afirmen hechos de telemetría;
- reindexación de KB añadida o retirada sin cambios de código.

Primero con deterministic generator.

**Done:** seis casos de `fixtures/support_questions.json` ejecutados y
registrados en `docs/RAG-EVALUATION.md`; tests de fuente correcta,
abstención e inyección pasan sin LLM externo.

## 8. Gemini adapter

Crear `AnswerGenerator` agnóstico y mantener el generador extractivo.

Implementar Gemini configurable como proveedor preferido cuando exista
API key. Sin ella, usar el generador extractivo. Mantener tests y demo
reproducibles sin proveedor externo.

**Done:** activar Gemini no cambia contratos ni reglas
de citas/abstención.

## 9. Finalization

- CI;
- README final;
- clean-clone rehearsal;
- adversarial verification;
- completar AI workflow;
- completar RAG evaluation/security;
- retrospective;
- demo rehearsal;
- final tag.
- video enlazado desde README, 8–12 minutos (máximo 15);
- verificar dos ciclos reales y una corrección humana en AI-WORKFLOW.

**Ready for final tag:** CI pasa, los dos oráculos y RAG seguro están
verificados, el panel P1 está disponible y el clean-clone/video fueron
completados. Tras fusionar este commit y verificar CI en `main`, crear
`entrega-final` sin otro cambio de código.

## Orden para agentes

Dar tareas pequeñas y verificables. Ejemplo:

> Implement Phase 1 database migrations following
> `docs/SPECIFICATION.md` and `docs/ARCHITECTURE.md`. Do not implement
> HTTP routes. Run migration/reset verification and report changed
> files.

No pedir a un agente "build the whole challenge".
