import type { TelemetryEvent } from './telemetry.js';

type VehicleStatus = 'OFF' | 'STOPPED' | 'MOVING';

export type DomainEvent =
  | {
      type: 'vehicle.updated';
      eventId: string;
      vehicleId: string;
      observedAt: string;
      vehicle: TelemetryEvent & { status: VehicleStatus };
    }
  | {
      type: 'alert.created';
      eventId: string;
      vehicleId: string;
      observedAt: string;
      alert: { id: number; type: 'OVERSPEED' };
    };

function statusFor(event: TelemetryEvent): VehicleStatus {
  if (!event.ignitionOn) {
    return 'OFF';
  }
  return event.speedKph === 0 ? 'STOPPED' : 'MOVING';
}

export function vehicleUpdated(event: TelemetryEvent): DomainEvent {
  return {
    type: 'vehicle.updated',
    eventId: event.eventId,
    vehicleId: event.vehicleId,
    observedAt: new Date(event.observedAt).toISOString(),
    vehicle: { ...event, status: statusFor(event) },
  };
}

export function alertCreated(event: TelemetryEvent, id: number): DomainEvent {
  return {
    type: 'alert.created',
    eventId: event.eventId,
    vehicleId: event.vehicleId,
    observedAt: new Date(event.observedAt).toISOString(),
    alert: { id, type: 'OVERSPEED' },
  };
}

export class EventBus {
  private readonly subscribers = new Set<(event: DomainEvent) => void>();

  publish(event: DomainEvent) {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  subscribe(subscriber: (event: DomainEvent) => void) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }
}
