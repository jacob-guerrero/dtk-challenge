import type { Pool, PoolClient } from 'pg';
import type { TelemetryEvent } from './telemetry.js';

type StoredEvent = {
  event_id: string;
  vehicle_id: string;
  observed_at: Date;
  latitude: number;
  longitude: number;
  speed_kph: number;
  ignition_on: boolean;
};

export type PersistedEventResult = {
  status: 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT';
  currentStateChanged: boolean;
  alertCreated: boolean;
};

function samePayload(event: TelemetryEvent, stored: StoredEvent): boolean {
  return (
    event.vehicleId === stored.vehicle_id &&
    Date.parse(event.observedAt) === stored.observed_at.getTime() &&
    event.latitude === stored.latitude &&
    event.longitude === stored.longitude &&
    event.speedKph === stored.speed_kph &&
    event.ignitionOn === stored.ignition_on
  );
}

async function isCurrentEvent(client: PoolClient, event: TelemetryEvent) {
  const result = await client.query<{ event_id: string }>(
    `SELECT event_id
     FROM telemetry_events
     WHERE vehicle_id = $1
     ORDER BY observed_at DESC, event_id DESC
     LIMIT 1`,
    [event.vehicleId],
  );
  return result.rows[0]?.event_id === event.eventId;
}

export class TelemetryRepository {
  constructor(private readonly pool: Pool) {}

  async persist(event: TelemetryEvent): Promise<PersistedEventResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO telemetry_events
          (event_id, vehicle_id, observed_at, latitude, longitude, speed_kph, ignition_on)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [
          event.eventId,
          event.vehicleId,
          event.observedAt,
          event.latitude,
          event.longitude,
          event.speedKph,
          event.ignitionOn,
        ],
      );

      if (inserted.rowCount === 0) {
        const existing = await client.query<StoredEvent>(
          `SELECT event_id, vehicle_id, observed_at, latitude, longitude, speed_kph, ignition_on
           FROM telemetry_events
           WHERE event_id = $1`,
          [event.eventId],
        );
        await client.query('COMMIT');

        if (!existing.rows[0]) {
          throw new Error(
            'Event identity was not available after an insert conflict.',
          );
        }

        return {
          status: samePayload(event, existing.rows[0])
            ? 'DUPLICATE'
            : 'CONFLICT',
          currentStateChanged: false,
          alertCreated: false,
        };
      }

      let alertCreated = false;
      if (event.speedKph > 80) {
        await client.query(
          `INSERT INTO alerts (event_id, vehicle_id, type)
           VALUES ($1, $2, 'OVERSPEED')`,
          [event.eventId, event.vehicleId],
        );
        alertCreated = true;
      }

      const currentStateChanged = await isCurrentEvent(client, event);
      await client.query('COMMIT');

      return { status: 'ACCEPTED', currentStateChanged, alertCreated };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
