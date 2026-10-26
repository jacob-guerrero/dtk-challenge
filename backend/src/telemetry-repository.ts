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
  alertId: number | null;
};

type VehicleRow = {
  event_id: string;
  vehicle_id: string;
  observed_at: Date;
  latitude: number;
  longitude: number;
  speed_kph: number;
  ignition_on: boolean;
  status: 'OFF' | 'STOPPED' | 'MOVING';
};

type AlertRow = {
  id: number;
  type: 'OVERSPEED';
  event_id: string;
  vehicle_id: string;
  observed_at: Date;
  created_at: Date;
};

function vehicleResponse(row: VehicleRow) {
  return {
    eventId: row.event_id,
    vehicleId: row.vehicle_id,
    observedAt: row.observed_at.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    speedKph: row.speed_kph,
    ignitionOn: row.ignition_on,
    status: row.status,
  };
}

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
          alertId: null,
        };
      }

      let alertId: number | null = null;
      if (event.speedKph > 80) {
        const alert = await client.query<{ id: number }>(
          `INSERT INTO alerts (event_id, vehicle_id, type)
           VALUES ($1, $2, 'OVERSPEED')
           RETURNING id`,
          [event.eventId, event.vehicleId],
        );
        alertId = alert.rows[0]?.id ?? null;
      }

      const currentStateChanged = await isCurrentEvent(client, event);
      await client.query('COMMIT');

      return { status: 'ACCEPTED', currentStateChanged, alertId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listVehicles(search?: string) {
    const result = await this.pool.query<VehicleRow>(
      `SELECT DISTINCT ON (vehicle_id)
         event_id, vehicle_id, observed_at, latitude, longitude, speed_kph, ignition_on,
         CASE
           WHEN ignition_on = false THEN 'OFF'
           WHEN speed_kph = 0 THEN 'STOPPED'
           ELSE 'MOVING'
         END AS status
       FROM telemetry_events
       WHERE ($1::text IS NULL OR vehicle_id ILIKE '%' || $1 || '%')
       ORDER BY vehicle_id, observed_at DESC, event_id DESC`,
      [search?.trim() || null],
    );
    return result.rows.map(vehicleResponse);
  }

  async listVehicleEvents(vehicleId: string) {
    const result = await this.pool.query<VehicleRow>(
      `SELECT event_id, vehicle_id, observed_at, latitude, longitude, speed_kph, ignition_on,
         CASE
           WHEN ignition_on = false THEN 'OFF'
           WHEN speed_kph = 0 THEN 'STOPPED'
           ELSE 'MOVING'
         END AS status
       FROM telemetry_events
       WHERE vehicle_id = $1
       ORDER BY observed_at ASC, event_id ASC`,
      [vehicleId],
    );
    return result.rows.map(vehicleResponse);
  }

  async listAlerts() {
    const result = await this.pool.query<AlertRow>(
      `SELECT alerts.id, alerts.type, alerts.event_id, alerts.vehicle_id,
         telemetry_events.observed_at, alerts.created_at
       FROM alerts
       JOIN telemetry_events ON telemetry_events.event_id = alerts.event_id
       ORDER BY alerts.created_at DESC, alerts.id DESC`,
    );
    return result.rows.map((alert) => ({
      id: alert.id,
      type: alert.type,
      eventId: alert.event_id,
      vehicleId: alert.vehicle_id,
      observedAt: alert.observed_at.toISOString(),
      createdAt: alert.created_at.toISOString(),
    }));
  }
}
