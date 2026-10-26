# Arquitectura

Estado: **baseline aceptado para comenzar implementación**.

## Objetivo

Construir la solución más simple que pruebe correctamente:

- ingestión de telemetría;
- idempotencia y concurrencia;
- estado actual por tiempo del evento;
- alertas de overspeed;
- dashboard Angular realtime;
- replay reproducible;
- Incident Copilot con retrieval, grounding, citations y seguridad.

No optimizar para una escala que el challenge no exige.

## Runtime

```text
Replay CLI ──REST/X-API-Key──► Express API ──pg──► PostgreSQL
                                    │
                                    ├──SSE──► Angular
                                    │
                                    └──RAG──► AnswerGenerator
                                               ├── Gemini (optional)
                                               └── Extractive fallback
```

PostgreSQL es el source of truth. SSE comunica cambios ya confirmados;
no es almacenamiento.

## Monorepo

```text
fleetpulse/
├── backend/
├── frontend/
├── replay/
├── packages/
│   └── contracts/
├── database/
│   └── migrations/
├── fixtures/
├── knowledge/
├── docs/
├── AGENTS.md
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

`packages/contracts` debe ser pequeño: contratos compartidos, no lógica
interna del backend.

## Decisiones principales

Tema Decisión

---

Backend Express + TypeScript
DB PostgreSQL
DB client raw `pg`
Migrations SQL
Validation/config Zod
Frontend Angular CSR
UI state Signals + RxJS
API REST
Realtime SSE
Internal events in-process event bus
Retrieval PostgreSQL FTS
Generation provider-agnostic `AnswerGenerator`
LLM Gemini preferido con API key; extractivo sin key
Fallback deterministic/extractive
Tests Vitest; PostgreSQL real donde importa
E2E Playwright opcional/minimal
API docs OpenAPI 3 + Swagger UI
Logs simples y sanitizados; Pino opcional
Containers Docker Compose
CI GitHub Actions

## Database

### `telemetry_events`

Campos lógicos:

```text
event_id        TEXT PRIMARY KEY
vehicle_id      TEXT NOT NULL
observed_at     TIMESTAMPTZ NOT NULL
latitude        DOUBLE PRECISION NOT NULL
longitude       DOUBLE PRECISION NOT NULL
speed_kph       DOUBLE PRECISION NOT NULL
ignition_on     BOOLEAN NOT NULL
received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

Constraints adicionales deben reflejar validaciones importantes cuando
sea razonable, por ejemplo latitud/longitud/speed.

Índice para estado/historial:

```text
(vehicle_id, observed_at, event_id)
```

### `alerts`

```text
id              BIGSERIAL PRIMARY KEY
event_id        TEXT NOT NULL UNIQUE REFERENCES telemetry_events(event_id)
vehicle_id      TEXT NOT NULL
type            TEXT NOT NULL
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

El ID interno puede ser generado por PostgreSQL; no necesitamos UUID.

### Estado actual

No mantener `vehicle_state` inicialmente.

Derivar desde eventos:

```text
por vehicle_id:
ORDER BY observed_at DESC, event_id DESC
LIMIT 1
```

Esto reduce estado mutable y hace natural el manejo de eventos tardíos.

### `knowledge_chunks`

Modelo lógico:

```text
id
source_id
chunk_index
content
metadata
search_vector
```

Debe poder reconstruirse determinísticamente desde `knowledge/*.md`.

## Batch y transacciones

El batch **no** usa una sola transacción global.

Cada evento válido se procesa independientemente para que un fallo no
revierta otros eventos.

Por evento:

```text
validate
  ↓
BEGIN
  ↓
insert/resolve identity atomically
  ├─ identical existing → DUPLICATE
  ├─ different existing → CONFLICT
  └─ new
       ├─ persist event
       ├─ speed > 80 → persist alert
       └─ determine whether it is current
  ↓
COMMIT
  ↓
publish committed domain notifications
```

La implementación exacta debe apoyarse en `PRIMARY KEY/UNIQUE` y manejar
la carrera de inserts correctamente. No usar un pre-check como única
protección.

## Internal event bus

Interfaz pequeña y tipada. Eventos mínimos:

```text
vehicle.updated
alert.created
```

Se usa memoria porque existe una sola instancia de API.

Escalamiento futuro:

- PostgreSQL LISTEN/NOTIFY o Redis Pub/Sub: sincronizar múltiples API
  instances.
- RabbitMQ: trabajos durables, acknowledgements/retries.
- Kafka: log durable de alto volumen y múltiples consumidores.

No son necesarios para el challenge.

## SSE

- SSE para server → browser.
- REST para comandos/queries.
- heartbeat periódico para mantener conexión visible.
- navegador puede reconectar.
- tras reconexión, REST puede resincronizar estado autoritativo.
- no construir replay durable del stream.

## RAG

```text
knowledge/*.md
      ↓
explicit knowledge:index
      ↓
chunks + PostgreSQL FTS
      ↓
retrieve top-k
      ↓
grounding gate
      ↓
AnswerGenerator
      ├─ Gemini
      └─ Extractive
      ↓
answer + citations + grounded + retrievalTrace
```

El código de aplicación controla retrieval, citations y abstention. El
LLM no decide si puede ignorar evidencia.
El generador extractivo permite completar P0 sin credenciales. Gemini
se selecciona cuando hay API key configurada; no cambia recuperación,
citas ni abstención. La API se puede explorar mediante Swagger UI.

`AnswerGenerator` no debe exponer tipos específicos de Gemini en sus
contratos públicos.

## Knowledge indexing

Usar comando explícito:

```bash
pnpm knowledge:index
```

Debe reconstruir el índice desde `knowledge/*.md` de forma reproducible.
Es más simple y demostrable que watchers/sincronización automática.

## Config

Variables de entorno validadas con Zod al startup.

Esperadas conceptualmente:

```text
DATABASE_URL
INGEST_API_KEY
PORT
LLM_PROVIDER         # opcional
GEMINI_API_KEY       # optional
```

La aplicación debe funcionar en modo fallback sin `GEMINI_API_KEY`.

Frontend nunca recibe secretos.

## Logging

Logging estructurado y simple; Pino puede añadirse si aporta valor.

Nunca loggear API keys, database URLs completas, prompts con secretos ni
dumps de environment.

## Scope

No agregar mapas, microservices, brokers, vector DB, SSR, Kubernetes,
auth compleja ni observability stack salvo que un requisito real lo
justifique.
