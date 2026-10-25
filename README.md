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
