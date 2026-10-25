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

## Reproductor de eventos

Con la API iniciada en otra terminal, ejecutar:

```bash
pnpm replay
```

El reproductor carga las 24 líneas del fixture oficial en su orden original.
Usar `start`, `pause`, `resume`, `restart`, `status` y `quit`. El intervalo
por defecto es 750 ms; se puede cambiar en `.env` con `REPLAY_INTERVAL_MS`.
`restart` reinicia el cursor, no borra la base de datos.

## Pruebas de integración

```bash
pnpm test:integration
```

La suite usa la base configurada en `.env` y elimina los registros de
`telemetry_events` y `alerts` antes de cada caso. Úsala solamente contra
datos locales desechables.
