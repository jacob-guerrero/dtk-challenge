import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set for integration tests.');
}

const apiKey = 'test-ingest-key';
const pool = new Pool({ connectionString: databaseUrl });
const app = createApp(pool, apiKey);
let server: Server | undefined;

type BatchCounts = { accepted: number; duplicates: number; rejected: number };

const fixturePath = fileURLToPath(
  new URL(
    '../../docs/Paquete_Enviar_Prueba/kit_inicial/fixtures/events.jsonl',
    import.meta.url,
  ),
);

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'E-TEST-001',
    vehicleId: 'VEH-TEST',
    observedAt: '2026-10-18T10:00:00Z',
    latitude: 14.602,
    longitude: -90.548,
    speedKph: 35,
    ignitionOn: true,
    ...overrides,
  };
}

function apiUrl(path: string) {
  if (!server) {
    throw new Error('Test server is not listening.');
  }
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}${path}`;
}

async function send(events: unknown[], key = apiKey) {
  return fetch(apiUrl('/api/events/batch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({ events }),
  });
}

async function get(path: string) {
  return fetch(apiUrl(path));
}

beforeAll(async () => {
  server = app.listen(0);
  await once(server, 'listening');
});

beforeEach(async () => {
  await pool.query('TRUNCATE alerts, telemetry_events RESTART IDENTITY');
});

afterAll(async () => {
  const activeServer = server;
  if (activeServer) {
    await new Promise<void>((resolve, reject) =>
      activeServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await pool.end();
});

describe('POST /api/events/batch', () => {
  it('accepts an event and creates one overspeed alert above 80 km/h', async () => {
    const response = await send([event({ speedKph: 81 })]);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      summary: { accepted: 1, duplicates: 0, conflicts: 0, rejected: 0 },
    });
    expect(await pool.query('SELECT * FROM alerts')).toHaveProperty(
      'rowCount',
      1,
    );
  });

  it('does not persist or alert twice for an identical event ID and payload', async () => {
    await send([event({ speedKph: 81 })]);
    const response = await send([event({ speedKph: 81 })]);

    expect(await response.json()).toMatchObject({
      accepted: 0,
      duplicates: 1,
      rejected: 0,
    });
    expect(await pool.query('SELECT * FROM telemetry_events')).toHaveProperty(
      'rowCount',
      1,
    );
    expect(await pool.query('SELECT * FROM alerts')).toHaveProperty(
      'rowCount',
      1,
    );
  });

  it('rejects an event ID conflict without overwriting the persisted event', async () => {
    await send([event({ speedKph: 35 })]);
    const response = await send([event({ speedKph: 125 })]);

    expect(await response.json()).toMatchObject({
      accepted: 0,
      rejected: 1,
      errors: [
        { index: 0, eventId: 'E-TEST-001', reason: 'EVENT_ID_CONFLICT' },
      ],
      summary: { conflicts: 1 },
    });
    const stored = await pool.query<{ speed_kph: number }>(
      'SELECT speed_kph FROM telemetry_events WHERE event_id = $1',
      ['E-TEST-001'],
    );
    expect(stored.rows[0]?.speed_kph).toBe(35);
    expect(await pool.query('SELECT * FROM alerts')).toHaveProperty(
      'rowCount',
      0,
    );
  });

  it('returns per-event validation errors while accepting valid siblings', async () => {
    const response = await send([
      event(),
      event({ eventId: 'E-TEST-002', latitude: 109.1 }),
      event({ eventId: 'E-TEST-003', speedKph: -1 }),
      event({ eventId: 'E-TEST-004', speedKph: '80' }),
    ]);

    expect(await response.json()).toMatchObject({
      accepted: 1,
      duplicates: 0,
      rejected: 3,
      errors: [
        { index: 1, reason: 'INVALID_LATITUDE' },
        { index: 2, reason: 'INVALID_SPEED' },
        { index: 3, reason: 'INVALID_SPEED' },
      ],
    });
  });

  it('requires the ingestion API key', async () => {
    const response = await send([event()], 'wrong-key');

    expect(response.status).toBe(401);
    expect(await pool.query('SELECT * FROM telemetry_events')).toHaveProperty(
      'rowCount',
      0,
    );
  });

  it('handles simultaneous identical requests as one accepted event and one duplicate', async () => {
    const responses = await Promise.all([send([event()]), send([event()])]);
    const bodies = await Promise.all(
      responses.map(async (response) => (await response.json()) as BatchCounts),
    );

    expect(bodies.map((body) => body.accepted).sort()).toEqual([0, 1]);
    expect(bodies.map((body) => body.duplicates).sort()).toEqual([0, 1]);
    expect(await pool.query('SELECT * FROM telemetry_events')).toHaveProperty(
      'rowCount',
      1,
    );
  });
});

describe('fleet query endpoints', () => {
  it('derives current vehicle state from newest observedAt and supports search', async () => {
    await send([
      event({
        eventId: 'E-LATEST',
        observedAt: '2026-10-18T10:10:00Z',
        speedKph: 0,
      }),
      event({
        eventId: 'E-LATE',
        observedAt: '2026-10-18T09:55:00Z',
        speedKph: 95,
      }),
      event({ eventId: 'E-OTHER', vehicleId: 'VEH-OTHER', ignitionOn: false }),
    ]);

    const response = await get('/api/vehicles?search=VEH-TEST');

    expect(await response.json()).toMatchObject({
      vehicles: [
        {
          vehicleId: 'VEH-TEST',
          eventId: 'E-LATEST',
          status: 'STOPPED',
        },
      ],
    });
  });

  it('returns event history in observedAt and eventId order', async () => {
    await send([
      event({ eventId: 'E-002', observedAt: '2026-10-18T10:05:00Z' }),
      event({ eventId: 'E-001', observedAt: '2026-10-18T10:00:00Z' }),
      event({ eventId: 'E-003', observedAt: '2026-10-18T10:05:00Z' }),
    ]);

    const response = await get('/api/vehicles/VEH-TEST/events');
    const body = (await response.json()) as {
      events: Array<{ eventId: string }>;
    };

    expect(body.events.map((storedEvent) => storedEvent.eventId)).toEqual([
      'E-001',
      'E-002',
      'E-003',
    ]);
  });

  it('returns historical overspeed alerts and a safe health response', async () => {
    await send([
      event({ eventId: 'E-ALERT-1', speedKph: 81 }),
      event({ eventId: 'E-NO-ALERT', speedKph: 80 }),
      event({ eventId: 'E-ALERT-2', speedKph: 95 }),
    ]);

    const [alertsResponse, healthResponse] = await Promise.all([
      get('/api/alerts'),
      get('/api/health'),
    ]);
    const alerts = (await alertsResponse.json()) as {
      alerts: Array<{ type: string; eventId: string }>;
    };

    expect(alerts.alerts).toHaveLength(2);
    expect(alerts.alerts.map((alert) => alert.type)).toEqual([
      'OVERSPEED',
      'OVERSPEED',
    ]);
    expect(alerts.alerts.map((alert) => alert.eventId)).toEqual([
      'E-ALERT-2',
      'E-ALERT-1',
    ]);
    expect(await healthResponse.json()).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });
});

describe('official replay oracle', () => {
  it('matches the first and second replay totals without a database reset', async () => {
    const events = (await readFile(fixturePath, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    async function replayOnce() {
      const totals = { accepted: 0, duplicates: 0, rejected: 0 };
      for (const replayEvent of events) {
        const response = await send([replayEvent]);
        const body = (await response.json()) as BatchCounts;
        totals.accepted += body.accepted;
        totals.duplicates += body.duplicates;
        totals.rejected += body.rejected;
      }
      return totals;
    }

    expect(await replayOnce()).toEqual({
      accepted: 20,
      duplicates: 2,
      rejected: 2,
    });
    expect(await replayOnce()).toEqual({
      accepted: 0,
      duplicates: 22,
      rejected: 2,
    });

    const [vehiclesResponse, alertsResponse] = await Promise.all([
      get('/api/vehicles'),
      get('/api/alerts'),
    ]);
    const vehicles = (await vehiclesResponse.json()) as { vehicles: unknown[] };
    const alerts = (await alertsResponse.json()) as { alerts: unknown[] };

    expect(vehicles.vehicles).toHaveLength(8);
    expect(alerts.alerts).toHaveLength(4);
  });
});
