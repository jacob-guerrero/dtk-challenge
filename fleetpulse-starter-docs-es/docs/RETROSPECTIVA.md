# Retrospectiva

Registro final de decisiones y evidencia de la implementación P0.

## Delivered

- Telemetry ingestion con validación por evento, idempotencia concurrente y
  alertas `OVERSPEED` estrictamente sobre 80 km/h.
- Migrations SQL y PostgreSQL como fuente de verdad; estado actual derivado
  por `observedAt` y `eventId`.
- Replay CLI reproducible, SSE posterior a commit y dashboard Angular CSR.
- Panel P1 de Incident Copilot en Angular con contexto opcional de vehículo,
  grounding, citas expandibles y traza de retrieval.
- Incident Copilot con indexación explícita de Markdown, PostgreSQL FTS,
  citas verificables, abstención y Gemini opcional con fallback extractivo.

## What went well

- El esquema SQL y los tests de integración detectaron invariantes que no
  conviene confiar a la UI o a lógica en memoria.
- Los comandos pequeños y commits por fase mantuvieron cambios revisables.
- El fallback extractivo permitió verificar RAG y seguridad sin depender de
  credenciales ni red externa.

## Difficult parts

- PostgreSQL no soportaba `isfinite(double precision)` en la migration
  inicial; las restricciones de rango se corrigieron y la migration quedó
  reproducible.
- TypeScript detectó incompatibilidades de módulos, dependencias Angular y un
  valor opcional de Gemini antes de ejecución.
- La primera consulta hostil recuperaba KB-99 sin priorizar KB-03; se añadió
  expansión léxica segura y KB-99 quedó solo en la traza, nunca como cita.

## Tradeoffs

Revisar especialmente:

- PostgreSQL FTS vs vector DB;
- in-process events vs broker;
- derived current state vs materialized state;
- deterministic fallback vs mandatory external LLM;
- simple dashboard vs non-required UI.

## AI-assisted development

AI aceleró la implementación de piezas pequeñas, tests y documentación. Las
decisiones humanas conservaron el alcance: PostgreSQL FTS en vez de vector DB,
SSE en vez de WebSockets y un LLM opcional. Las correcciones reales y su
evidencia están registradas por sesión en `docs/AI-WORKFLOW.md`.

## What I would change for production

- Externalizar SSE con LISTEN/NOTIFY o Redis Pub/Sub si existen múltiples
  instancias de API.
- Aplicar autenticación/autorización de usuarios, rate limiting y secretos
  gestionados fuera de archivos de entorno locales.
- Añadir retención/particionado y observabilidad si crece el volumen de
  telemetría.
- Evaluar retrieval híbrido/vectorial solo si la búsqueda léxica deja de ser
  suficiente para un corpus real.

## Final verification

- fresh clone: verificado en la demostración grabada desde un clon limpio;
  instalación, migrations, indexación, aplicaciones y replay funcionaron.
- first replay: verificado manualmente: 20 aceptados, 2 duplicados y 2
  rechazados; 8 vehículos y 4 alertas.
- second replay: verificado manualmente: 0 aceptados, 22 duplicados y 2
  rechazados; 4 alertas persistentes.
- tests/CI: los comandos locales y el primer CI remoto pasaron. El workflow
  creó PostgreSQL, aplicó ambas migrations, indexó cinco KB y ejecutó 18
  tests, lint, typecheck, formato y build Angular correctamente.
- RAG/security: seis casos oficiales, extensibilidad add/remove y Gemini
  opcional verificados; la evidencia está en `docs/RAG-EVALUATION.md`.
- demo rehearsal: grabado en dos partes consecutivas y enlazado desde el
  README; cubre replay, realtime, RAG seguro, CI y uso de IA agéntica.
- final tag: pendiente de crear desde `main` después de fusionar este enlace.
