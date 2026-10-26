# API Contracts

Los nombres exactos se consideran congelados al comenzar implementación
salvo incompatibilidad con el challenge oficial.

## `POST /api/events/batch`

Header:

```text
X-API-Key: <secret>
```

Request:

```json
{
  "events": [
    {
      "eventId": "E-001-01",
      "vehicleId": "VEH-001",
      "observedAt": "2026-01-01T10:00:00Z",
      "latitude": 3.45,
      "longitude": -76.53,
      "speedKph": 35,
      "ignitionOn": true
    }
  ]
}
```

Response shape (campos mínimos del contrato oficial en el nivel superior):

```json
{
  "accepted": 1,
  "duplicates": 0,
  "rejected": 1,
  "errors": [
    { "index": 1, "eventId": "E-006-03", "reason": "INVALID_LATITUDE" }
  ],
  "summary": {
    "accepted": 1,
    "duplicates": 0,
    "conflicts": 0,
    "rejected": 1
  },
  "results": [
    {
      "index": 0,
      "eventId": "E-001-01",
      "status": "ACCEPTED"
    },
    {
      "index": 1,
      "eventId": "E-006-03",
      "status": "REJECTED"
    }
  ]
}
```

`errors` usa índices relativos al lote y motivos seguros. `summary` facilita
leer la respuesta y conserva el contador separado de conflictos; sus
`accepted`, `duplicates` y `rejected` repiten los campos superiores para
cumplir el contrato oficial. `results` permite ver el resultado de cada
entrada. Un resultado rechazado
puede incluir detalle seguro de validación:

```json
{
  "index": 2,
  "eventId": "E-006-03",
  "status": "REJECTED",
  "errors": [
    {
      "field": "latitude",
      "message": "Must be between -90 and 90"
    }
  ]
}
```

Un conflicto se informa explícitamente por evento: `status: "CONFLICT"`
en `results` y `reason: "EVENT_ID_CONFLICT"` en `errors`. Cuenta en
`summary.conflicts` y en `rejected`/`summary.rejected`, porque no se acepta
ni se persiste. Así `accepted + duplicates + rejected = events.length`;
`conflicts` es un subconjunto de `rejected`, no se suma otra vez. Un
conflicto no falla los registros válidos del mismo lote.

Un lote vacío y un cuerpo fuera del límite configurado reciben `400` con
un motivo seguro; JSON malformado también recibe `400`.

## `GET /api/vehicles`

Conceptual response:

```json
{
  "vehicles": [
    {
      "vehicleId": "VEH-001",
      "eventId": "E-001-02",
      "observedAt": "...",
      "latitude": 0,
      "longitude": 0,
      "speedKph": 35,
      "ignitionOn": true,
      "status": "MOVING"
    }
  ]
}
```

Admite búsqueda por `vehicleId` (por ejemplo, `?search=VEH-001`). No se
requiere paginación para el fixture.

## `GET /api/vehicles/:vehicleId/events`

Returns deterministic history ascending by `observedAt`, then `eventId`.
Para un vehículo desconocido, devolver `[]` (decisión local documentada).

## `GET /api/alerts`

Returns alerts in deterministic order. Prefer newest first for UI, with
a stable tie-breaker.

## `GET /api/health`

Safe health response only. Example:

```json
{
  "status": "ok",
  "database": "ok"
}
```

## `GET /api/stream`

SSE.

Event examples:

```text
event: vehicle.updated
data: {"type":"vehicle.updated","eventId":"E-001-02","vehicleId":"VEH-001","observedAt":"2026-10-18T10:05:00Z","vehicle":{"status":"MOVING","speedKph":35}}
```

```text
event: alert.created
data: {"type":"alert.created","eventId":"E-001-00","vehicleId":"VEH-001","observedAt":"2026-10-18T09:55:00Z","alert":{"id":1,"type":"OVERSPEED"}}
```

Heartbeat may use SSE comment lines so it does not become an application
event.
El dashboard obtiene un snapshot REST al abrir/reconectar y después aplica
SSE; demostrar dos clientes conectados a la vez. No se exige buffer SSE.

## `POST /api/support/ask`

Request:

```json
{
  "question": "Why did VEH-001 generate an overspeed alert?",
  "vehicleId": "VEH-001"
}
```

`vehicleId` is optional context.
Si la respuesta afirma datos de un evento o alerta, añadir citas
`EVENT:<eventId>` o `ALERT:<id>` con evidencia verificable. La ausencia
de registros no demuestra que un hecho nunca ocurrió.

Response:

```json
{
  "answer": "...",
  "grounded": true,
  "citations": [
    {
      "sourceId": "KB-01",
      "excerpt": "fragmento literal del documento"
    }
  ],
  "retrievalTrace": [
    {
      "sourceId": "KB-01",
      "score": 0.87,
      "excerpt": "fragmento recuperado"
    }
  ]
}
```

`retrievalTrace` lista fuentes recuperadas, puntuación y fragmento. Las
citas de KB deben contener texto literal de la fuente indexada. Si no hay
evidencia suficiente: respuesta de abstención, `grounded: false` y
`citations: []`.

## HTTP errors

Keep simple:

- `400`: malformed JSON/request envelope.
- `401`: missing/wrong ingest API key.
- `404`: unknown resource where applicable.
- `500`: unexpected server failure with sanitized body.

Per-event invalid/conflict outcomes stay inside a successful batch
response rather than rejecting valid sibling events.
