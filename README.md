# FleetPulse + Incident Copilot

Implementación del reto en este repositorio. La [especificación y el plan](fleetpulse-starter-docs-es/README.md)
están en `fleetpulse-starter-docs-es/`; el paquete oficial está en
`docs/Paquete_Enviar_Prueba/`.

## Estado

Paso 0: estructura del monorepo y configuración local. API, migraciones,
Angular, replay y RAG se implementan en los siguientes pasos.

## Requisitos locales

- Node.js 22 o superior y pnpm 10.
- Docker Compose con integración disponible en el entorno de trabajo.

## Primer arranque

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
pnpm typecheck
pnpm lint
```

Definir `INGEST_API_KEY` con un valor local propio en `.env` antes de
iniciar la futura API. La clave de Gemini es opcional. `pnpm db:up`
comprueba la salud de PostgreSQL y `pnpm db:migrate` aplica el esquema.

Para reiniciar datos sintéticos locales durante el desarrollo:

```bash
pnpm db:reset
```

Este comando elimina únicamente el volumen de PostgreSQL de este proyecto.

## Rutas disponibles

Durante la fase de ingestión, iniciar la API con `pnpm dev` y enviar eventos
a `POST /api/events/batch`. El header `X-API-Key` debe coincidir con
`INGEST_API_KEY` de `.env`.

La documentación interactiva está disponible en
`http://localhost:3000/api/docs` y el documento OpenAPI en
`http://localhost:3000/api/openapi.json`.

Las actualizaciones en vivo usan SSE en `GET /api/stream`. La API emite
`vehicle.updated` después de un evento aceptado que cambia el estado actual y
`alert.created` después de crear una alerta confirmada.

## Reproductor de eventos

Con la API iniciada en otra terminal, ejecutar:

```bash
pnpm replay
```

El reproductor carga las 24 líneas del fixture oficial en su orden original.
Usar `start`, `pause`, `resume`, `restart`, `status` y `quit`. El intervalo
por defecto es 750 ms; se puede cambiar en `.env` con `REPLAY_INTERVAL_MS`.
`restart` reinicia el cursor, no borra la base de datos.

## Incident Copilot

Después de aplicar migraciones, indexar los runbooks Markdown con:

```bash
pnpm knowledge:index
```

El índice se reconstruye desde `docs/Paquete_Enviar_Prueba/kit_inicial/knowledge/`
en cada ejecución. La API `POST /api/support/ask` devuelve respuesta,
citas, `grounded` y una traza de recuperación; no requiere una API de LLM.

## Dashboard Angular

Con `pnpm dev` ejecutando la API, iniciar el dashboard en otra terminal:

```bash
pnpm dev:web
```

Abrir `http://localhost:4200`. El proxy de desarrollo reenvía `/api` al
backend local; la API key nunca llega al navegador.

Si se ejecuta `pnpm db:reset` mientras el dashboard ya está abierto, usar
**Refresh snapshot** antes de iniciar un replay. El reset elimina datos de
forma local y no produce eventos SSE de eliminación.

## Pruebas de integración

```bash
pnpm test:integration
```

La suite usa la base configurada en `.env` y elimina los registros de
`telemetry_events` y `alerts` antes de cada caso. Úsala solamente contra
datos locales desechables.
