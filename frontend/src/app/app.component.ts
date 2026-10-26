import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

type Status = 'OFF' | 'STOPPED' | 'MOVING';

type Vehicle = {
  eventId: string;
  vehicleId: string;
  observedAt: string;
  speedKph: number;
  ignitionOn: boolean;
  status: Status;
};

type Alert = {
  id: number;
  type: 'OVERSPEED';
  eventId: string;
  vehicleId: string;
  observedAt: string;
  createdAt: string;
};

type VehicleUpdated = {
  type: 'vehicle.updated';
  eventId: string;
  vehicleId: string;
  observedAt: string;
  vehicle: Vehicle;
};

type AlertCreated = {
  type: 'alert.created';
  eventId: string;
  vehicleId: string;
  observedAt: string;
  alert: { id: number; type: 'OVERSPEED' };
};

type Citation = {
  sourceId: string;
  excerpt: string;
};

type SupportAnswer = {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  retrievalTrace: Array<Citation & { score: number }>;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  readonly vehicles = signal<Vehicle[]>([]);
  readonly alerts = signal<Alert[]>([]);
  readonly history = signal<Vehicle[]>([]);
  readonly selectedVehicleId = signal<string | null>(null);
  readonly search = signal('');
  readonly connected = signal(false);
  readonly error = signal<string | null>(null);
  readonly supportQuestion = signal('');
  readonly supportAnswer = signal<SupportAnswer | null>(null);
  readonly supportLoading = signal(false);
  readonly supportError = signal<string | null>(null);

  private stream?: EventSource;

  constructor(private readonly http: HttpClient) {}

  ngOnInit() {
    void this.refresh();
    this.connectStream();
  }

  ngOnDestroy() {
    this.stream?.close();
  }

  async refresh() {
    try {
      const search = this.search().trim();
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const [vehicleResponse, alertResponse] = await Promise.all([
        firstValueFrom(
          this.http.get<{ vehicles: Vehicle[] }>(`/api/vehicles${query}`),
        ),
        firstValueFrom(this.http.get<{ alerts: Alert[] }>('/api/alerts')),
      ]);
      this.vehicles.set(vehicleResponse.vehicles);
      this.alerts.set(alertResponse.alerts);
      const selectedVehicleId = this.selectedVehicleId();
      if (
        selectedVehicleId &&
        !vehicleResponse.vehicles.some(
          (vehicle) => vehicle.vehicleId === selectedVehicleId,
        )
      ) {
        this.selectedVehicleId.set(null);
        this.history.set([]);
      }
      this.error.set(null);
    } catch {
      this.error.set('Unable to load the fleet snapshot.');
    }
  }

  async selectVehicle(vehicleId: string) {
    this.selectedVehicleId.set(vehicleId);
    try {
      const response = await firstValueFrom(
        this.http.get<{ events: Vehicle[] }>(
          `/api/vehicles/${encodeURIComponent(vehicleId)}/events`,
        ),
      );
      this.history.set(response.events);
    } catch {
      this.error.set('Unable to load vehicle history.');
    }
  }

  clearSelectedVehicle() {
    this.selectedVehicleId.set(null);
    this.history.set([]);
  }

  onSearch(value: string) {
    this.search.set(value);
    void this.refresh();
  }

  async askSupport(event: SubmitEvent) {
    event.preventDefault();
    const question = this.supportQuestion().trim();
    if (!question || this.supportLoading()) {
      return;
    }

    this.supportLoading.set(true);
    this.supportError.set(null);
    try {
      const vehicleId = this.selectedVehicleId();
      const answer = await firstValueFrom(
        this.http.post<SupportAnswer>('/api/support/ask', {
          question,
          ...(vehicleId ? { vehicleId } : {}),
        }),
      );
      this.supportAnswer.set(answer);
    } catch {
      this.supportError.set('Unable to get a support answer.');
    } finally {
      this.supportLoading.set(false);
    }
  }

  onSupportQuestion(value: string) {
    this.supportQuestion.set(value);
  }

  private connectStream() {
    this.stream = new EventSource('/api/stream');
    this.stream.onopen = () => {
      this.connected.set(true);
      void this.refresh();
    };
    this.stream.onerror = () => this.connected.set(false);
    this.stream.addEventListener('vehicle.updated', (message) => {
      const update = JSON.parse(
        (message as MessageEvent<string>).data,
      ) as VehicleUpdated;
      this.vehicles.update((vehicles) => {
        const byId = new Map(
          vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]),
        );
        byId.set(update.vehicleId, update.vehicle);
        return [...byId.values()].sort((left, right) =>
          left.vehicleId.localeCompare(right.vehicleId),
        );
      });
      if (this.selectedVehicleId() === update.vehicleId) {
        void this.selectVehicle(update.vehicleId);
      }
    });
    this.stream.addEventListener('alert.created', (message) => {
      const update = JSON.parse(
        (message as MessageEvent<string>).data,
      ) as AlertCreated;
      this.alerts.update((alerts) => [
        {
          id: update.alert.id,
          type: update.alert.type,
          eventId: update.eventId,
          vehicleId: update.vehicleId,
          observedAt: update.observedAt,
          createdAt: new Date().toISOString(),
        },
        ...alerts,
      ]);
    });
  }
}
