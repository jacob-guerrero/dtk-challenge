# Testing

Objetivo: **pocas pruebas de alto valor**.

No construir una arquitectura de testing compleja.

## Tooling

- Vitest.
- PostgreSQL real para tests que dependen de
  constraints/transactions/concurrency.
- Playwright opcional: máximo unos pocos smoke tests si queda tiempo.

## Must-have tests

### Telemetry

- valid event → accepted;
- invalid latitude → rejected;
- negative speed → rejected;
- `"80"` string → rejected;
- 80 → no alert;
- 81 → alert;
- duplicate same payload;
- same ID/different payload → conflict;
- concurrent duplicate → one stored event;
- late event stored but does not replace current state;
- late overspeed creates alert;
- missing/wrong API key.
- JSON malformado, lote vacío y lote parcialmente válido con índices y
  motivos correctos;
- timestamp sin zona, coordenadas fuera de rango y números no finitos.

### Replay

Un test/integration check debe probar los dos oracles oficiales:

```text
first:  20 accepted / 2 duplicate / 2 rejected / 4 alerts
second: 0 accepted / 22 duplicate / 2 rejected / still 4 alerts
```

### Realtime

Probar solo invariantes críticas:

- committed current event → `vehicle.updated`;
- committed overspeed → `alert.created`;
- duplicate/conflict/rejected → nothing;
- late non-current event → no `vehicle.updated`.
- dos clientes simultáneos reciben el mismo cambio confirmado.

### RAG

- relevant KB retrieved;
- unsupported question abstains;
- citations are real;
- malicious KB does not expose secrets;
- fallback works without Gemini.
- reindexar tras añadir una KB nueva o retirar una fuente cambia la
  recuperación sin editar código.

Ejecutar los seis casos oficiales y registrar respuesta, `grounded`,
fuentes, traza y observaciones en `docs/RAG-EVALUATION.md`.

## What not to test heavily

No buscar 100% coverage.

No duplicar todos los casos en unit + integration + E2E.

No hacer E2E para demostrar invariantes que PostgreSQL integration tests
prueban mejor.

## CI

Gate mínimo:

```text
lint
typecheck
test
build
```

Agregar Playwright al CI solo si resulta estable y barato.
