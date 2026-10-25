CREATE TABLE telemetry_events (
  event_id TEXT PRIMARY KEY CHECK (btrim(event_id) <> ''),
  vehicle_id TEXT NOT NULL CHECK (btrim(vehicle_id) <> ''),
  observed_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed_kph DOUBLE PRECISION NOT NULL CHECK (speed_kph >= 0),
  ignition_on BOOLEAN NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX telemetry_events_vehicle_observed_event_idx
  ON telemetry_events (vehicle_id, observed_at, event_id);

CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES telemetry_events (event_id),
  vehicle_id TEXT NOT NULL CHECK (btrim(vehicle_id) <> ''),
  type TEXT NOT NULL CHECK (type = 'OVERSPEED'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alerts_vehicle_created_id_idx
  ON alerts (vehicle_id, created_at DESC, id DESC);
