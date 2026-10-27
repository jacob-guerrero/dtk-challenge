# FleetPulse + Incident Copilot

Implementación del reto en este repositorio. La [especificación y el plan](fleetpulse-starter-docs-es/README.md)
están en `fleetpulse-starter-docs-es/`; el paquete oficial está en
`docs/Paquete_Enviar_Prueba/`.

## Estado

Implementación P0 completa: ingestión idempotente, PostgreSQL migrations,
replay controlado, consultas de flota, SSE, dashboard Angular y Incident
Copilot con PostgreSQL FTS, citas, abstención y Gemini opcional. También se
incluye el panel P1 de Incident Copilot en Angular. La entrega externa sigue
pendiente únicamente del tag final.

## Requisitos locales

- Node.js 22 o superior y pnpm 10.
- Docker Compose con integración disponible en el entorno de trabajo.

## Primer arranque

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm knowledge:index
pnpm dev
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

En una demostración limpia, iniciar `pnpm dev` y `pnpm dev:web` antes de
ejecutar el replay. El primer ciclo debe terminar con 20 aceptados, 2
duplicados, 2 rechazados, 8 vehículos y 4 alertas. Un segundo ciclo, sin
reiniciar la base, debe terminar con 0 aceptados, 22 duplicados, 2 rechazados
y conservar 4 alertas.

## Incident Copilot

Después de aplicar migraciones, indexar los runbooks Markdown con:

```bash
pnpm knowledge:index
```

El índice se reconstruye desde `docs/Paquete_Enviar_Prueba/kit_inicial/knowledge/`
en cada ejecución. La API `POST /api/support/ask` devuelve respuesta,
citas, `grounded` y una traza de recuperación; no requiere una API de LLM.

El modo predeterminado es `LLM_PROVIDER=extractive`, determinista y sin
credenciales. Para usar Gemini de forma opcional, configurar en `.env`:

```text
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
```

La aplicación mantiene retrieval, grounding y citas; Gemini solo redacta a
partir de evidencia ya seleccionada. Si Gemini no tiene clave o su petición
falla, el generador extractivo responde sin cambiar el contrato de la API.

## Dashboard Angular

Con `pnpm dev` ejecutando la API, iniciar el dashboard en otra terminal:

```bash
pnpm dev:web
```

Abrir `http://localhost:4200`. El proxy de desarrollo reenvía `/api` al
backend local; la API key nunca llega al navegador.

El panel **Incident Copilot** usa el vehículo seleccionado como contexto
opcional y muestra respuesta, grounding, citas literales y traza de
recuperación. No envía claves al navegador.

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

## CI y entrega

GitHub Actions ejecuta migraciones sobre PostgreSQL efímero, typecheck, lint,
formato, integración y build Angular para cada push y pull request. Los
detalles están en `.github/workflows/ci.yml`.

El clean-clone y la demostración verifican el replay con pausa/reanudación,
el segundo ciclo, dashboard en vivo, consulta RAG con citas/traza, abstención
y caso hostil.

## Video de demostración

La demostración está dividida en dos partes consecutivas (aproximadamente
10 minutos en conjunto):

1. [Parte 1 — Aplicación, arquitectura y replay](https://www.loom.com/share/7e3877f24be34d2ca075f244d62ecb17)
2. [Parte 2 — Incident Copilot, calidad y proceso](https://www.loom.com/share/efc2c09cb60943dca48163c25b274f98)
