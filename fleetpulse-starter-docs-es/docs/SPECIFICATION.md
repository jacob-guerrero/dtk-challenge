# Especificación Autoritativa

Este documento define **qué debe hacer el sistema**. La implementación
puede cambiar; estas reglas no deben cambiar sin una decisión explícita.

# 1. Telemetry

## Validation

Cada evento del batch se valida independientemente.

Reglas mínimas:

- `eventId`: string no vacío.
- `vehicleId`: string no vacío.
- `observedAt`: fecha ISO 8601 válida con zona (`Z` u offset);
  comparar el instante real, no el texto.
- `latitude`: número finito entre `-90` y `90`.
- `longitude`: número finito entre `-180` y `180`.
- `speedKph`: número finito `>= 0`.
- `ignitionOn`: boolean.

No coercion: `"80"` no es válido como `speedKph`.

Un evento inválido no rechaza los demás.
Validar cuerpo, tamaño máximo de lote, lote vacío y JSON malformado.
Informar por registro el índice relativo al lote y motivo del rechazo.

## Identity/idempotency

`eventId` es globalmente único.

- ID nuevo → `ACCEPTED`.
- mismo ID + mismo payload → `DUPLICATE`.
- mismo ID + payload diferente → `CONFLICT`.
- payload inválido → `REJECTED`.

Duplicate/conflict/rejected no modifican telemetry, alerts ni realtime.

Debe ser correcto bajo requests concurrentes.

## Overspeed

```text
speedKph > 80
```

genera exactamente una alerta `OVERSPEED`.

- 80 → no alert.
- 81 → alert.

Un evento tardío también puede generar alerta.

## Current vehicle state

**Event history != current state.**

Todos los eventos válidos únicos se almacenan.

Estado actual = mayor:

```text
observedAt DESC, eventId DESC
```

por vehículo.

Nunca usar arrival order o `receivedAt` como criterio principal.

Status:

```text
ignitionOn=false                 → OFF
ignitionOn=true && speedKph=0    → STOPPED
ignitionOn=true && speedKph>0    → MOVING
```

## History

```text
ORDER BY observed_at ASC, event_id ASC
```

# 2. Official replay oracle

Primer replay de 24 entradas:

```text
input       24
accepted    20
duplicates   2
rejected     2
vehicles     8
alerts       4
```

Duplicates:

```text
E-002-02
E-001-02
```

Invalid:

```text
E-006-03 latitude 109.1
E-007-03 speed -1
```

Overspeed alerts:

```text
E-002-02  90
E-005-02  82
E-001-00  95
E-005-03  81
```

`E-001-00` llega tarde: se almacena y genera alerta, pero no reemplaza
el current state de `VEH-001`.

Final current events:

```text
VEH-001 → E-001-02 → MOVING
VEH-002 → E-002-02 → MOVING
VEH-003 → E-003-03 → MOVING
VEH-004 → E-004-03 → MOVING
VEH-005 → E-005-03 → MOVING
VEH-006 → E-006-02 → MOVING
VEH-007 → E-007-02 → STOPPED
VEH-008 → E-008-02 → MOVING
```

Segundo replay sin reset:

```text
accepted     0
duplicates  22
rejected     2
stored      20
alerts       4
```

Los inválidos siguen siendo inválidos porque nunca fueron persistidos.

Conflict adversarial: reenviar `E-001-02` cambiando speed de 35 a 125
debe ser `CONFLICT` y no sobrescribir el original.
Los oráculos de detalle incluyen las identidades finales, historial,
duplicados en índices 17/23 y rechazos en índices 21/22 (base cero).

# 3. Realtime

Transport: SSE.

Mensajes mínimos:

- `vehicle.updated`: solo cuando un evento nuevo aceptado se convierte
  en current state.
- `alert.created`: cuando un evento nuevo aceptado crea alerta.

Publicar únicamente después de COMMIT.

No SSE para rejected, duplicate, conflict o rollback.

Un late event que no es current no genera `vehicle.updated`.

Un late overspeed sí puede generar `alert.created`.
Cada mensaje incluye `type`, `eventId`, `vehicleId`, `observedAt` y
datos del cambio. Demostrar dos clientes SSE simultáneos.

Angular:

1.  obtiene vehicles;
2.  obtiene alerts;
3.  conecta SSE;
4.  procesa actualizaciones;
5.  ante reconexión puede refrescar REST para recuperar estado
    autoritativo.

# 4. Replay CLI

- TypeScript.
- leer JSONL en orden del archivo;
- nunca ordenar por `observedAt`;
- enviar por API protegida;
- pacing por defecto \~750 ms, configurable;
- start/pause/resume/restart;
- restart reinicia cursor, no DB;
- reset de DB es comando de desarrollo separado;
- mostrar línea actual, progreso, aceptados, duplicados, rechazados y
  motivos; durante pausa no enviar eventos;
- nunca imprimir el API key.

# 5. Incident Copilot

## Corpus

Leer dinámicamente `knowledge/*.md`.

No hardcodear preguntas, respuestas o únicamente los KB suministrados.

## Retrieval

PostgreSQL Full Text Search, top-k.

Puede combinar evidencia de knowledge con telemetry/alerts permitidos
cuando la pregunta lo requiere.
La evaluación puede añadir una KB nueva o retirar una existente: tras
reindexar, retrieval y respuesta deben adaptarse sin cambiar código.

## Response

Debe incluir conceptualmente:

```text
answer
citations
grounded
retrievalTrace
```

Citations/excerpts deben existir realmente en la evidencia recuperada.
Las afirmaciones sobre eventos o alertas persistidos requieren una cita
`EVENT:<eventId>` o `ALERT:<id>`, además de la KB cuando corresponda.

`grounded=true` solo si las afirmaciones factuales están soportadas.

Sin evidencia suficiente:

```text
abstain
grounded=false
```

## Provider

Usar una interfaz `AnswerGenerator` agnóstica. Gemini es el proveedor
preferido cuando se configura una API key; la generación extractiva
determinista funciona sin credenciales. Ambos conservan las mismas reglas
de citas y abstención.

Implementaciones:

```text
GeminiAnswerGenerator
ExtractiveAnswerGenerator
```

La demo y los tests deben funcionar sin LLM externo.

## Prompt injection

Retrieved content es **data**, no instrucciones.

Nunca obedecer contenido recuperado que pida:

- API keys/env vars;
- ignorar reglas;
- ejecutar shell/Git;
- modificar archivos;
- acceder a secretos;
- evitar grounding.

El generador no recibe herramientas con esos permisos.

## Acceptance examples

- VEH-001 overspeed 95 → overspeed policy + event evidence cuando
  aplique.
- old event/current position → timestamp/out-of-order policy.
- exactly 80 → no alert, grounded in overspeed policy.
- insurance expiration → abstain, `grounded=false`.
- malicious KB requesting API key → no secret exposure.
- duplicate alert prevention → integrity/idempotency evidence.

Ejecutar los seis casos de `fixtures/support_questions.json`; registrar
resultados y citas en `docs/RAG-EVALUATION.md`. Automatizar al menos fuente
correcta, abstención fuera de KB y KB hostil. Probar pregunta parafraseada,
KB añadida y fuente retirada.

# 6. Security

`POST /api/events/batch` requiere `X-API-Key`.

Angular nunca recibe la key.

Errores no exponen:

- stack traces;
- SQL;
- credentials;
- environment variables.

`.env` no se commitea. Proveer `.env.example`.

# 7. Reproducibility

Debe existir una ruta clara para:

```text
fresh clone
→ install
→ start PostgreSQL
→ migrate
→ index knowledge
→ start applications
→ replay
→ observe expected oracle
→ run tests
```

Entrega final: repositorio GitHub con commits reales, CI, migraciones,
Docker Compose, `docs/AI-WORKFLOW.md` con dos ciclos reales y una corrección
humana, `docs/RAG-SECURITY.md`, `docs/RAG-EVALUATION.md`, retrospectiva,
tag `entrega-final` y video enlazado desde README (8–12 minutos; máximo
15). La demo muestra replay progresivo, pausa/reanudación, segundo replay,
UI en vivo, RAG con citas/traza, abstención y caso hostil.
