import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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

type BatchCounts = { accepted: number; duplicates: number };

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

function endpoint() {
  if (!server) {
    throw new Error('Test server is not listening.');
  }
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/api/events/batch`;
}

async function send(events: unknown[], key = apiKey) {
  return fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({ events }),
  });
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
