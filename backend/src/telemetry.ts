import { z } from 'zod';

const timestampWithZone = z
  .string()
  .refine(
    (value) =>
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value)),
    'Must be an ISO 8601 timestamp with a timezone',
  );

export const telemetryEventSchema = z.object({
  eventId: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  observedAt: timestampWithZone,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  speedKph: z.number().finite().nonnegative(),
  ignitionOn: z.boolean(),
});

export const batchSchema = z.object({
  events: z.array(z.unknown()).min(1).max(100),
});

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export type EventFailureReason =
  | 'INVALID_EVENT'
  | 'INVALID_EVENT_ID'
  | 'INVALID_VEHICLE_ID'
  | 'INVALID_OBSERVED_AT'
  | 'INVALID_LATITUDE'
  | 'INVALID_LONGITUDE'
  | 'INVALID_SPEED'
  | 'INVALID_IGNITION'
  | 'EVENT_ID_CONFLICT';

export function getFailureReason(input: unknown): EventFailureReason {
  const parsed = telemetryEventSchema.safeParse(input);
  if (parsed.success) {
    return 'INVALID_EVENT';
  }

  const field = parsed.error.issues[0]?.path[0];
  switch (field) {
    case 'eventId':
      return 'INVALID_EVENT_ID';
    case 'vehicleId':
      return 'INVALID_VEHICLE_ID';
    case 'observedAt':
      return 'INVALID_OBSERVED_AT';
    case 'latitude':
      return 'INVALID_LATITUDE';
    case 'longitude':
      return 'INVALID_LONGITUDE';
    case 'speedKph':
      return 'INVALID_SPEED';
    case 'ignitionOn':
      return 'INVALID_IGNITION';
    default:
      return 'INVALID_EVENT';
  }
}

export function eventIdFrom(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || !('eventId' in input)) {
    return undefined;
  }

  return typeof input.eventId === 'string' ? input.eventId : undefined;
}
