export type ReplayEvent = Record<string, unknown>;

export type BatchResponse = {
  accepted: number;
  duplicates: number;
  rejected: number;
  errors: Array<{ index: number; eventId?: string; reason: string }>;
  summary?: { conflicts: number };
};

export type ReplayStats = {
  accepted: number;
  duplicates: number;
  rejected: number;
  conflicts: number;
};

export type ReplayProgress = {
  line: number;
  total: number;
  eventId: string;
  stats: ReplayStats;
  errors: BatchResponse['errors'];
};

export function parseJsonLines(content: string): ReplayEvent[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      try {
        const parsed: unknown = JSON.parse(line);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Each line must be a JSON object.');
        }
        return parsed as ReplayEvent;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        throw new Error(`Invalid fixture at line ${index + 1}: ${message}`);
      }
    });
}

export class ReplayController {
  private cursor = 0;
  private running = false;
  private processing = false;
  private stats: ReplayStats = {
    accepted: 0,
    duplicates: 0,
    rejected: 0,
    conflicts: 0,
  };

  constructor(
    private readonly events: ReplayEvent[],
    private readonly intervalMs: number,
    private readonly ingest: (event: ReplayEvent) => Promise<BatchResponse>,
    private readonly report: (progress: ReplayProgress) => void,
    private readonly reportError: (message: string) => void,
  ) {}

  start(): Promise<void> {
    if (this.cursor === this.events.length) {
      this.reportError('Replay complete. Use restart to replay from line 1.');
      return Promise.resolve();
    }

    this.running = true;
    if (!this.processing) {
      return this.run();
    }
    return Promise.resolve();
  }

  pause() {
    this.running = false;
  }

  restart() {
    this.pause();
    this.cursor = 0;
    this.stats = { accepted: 0, duplicates: 0, rejected: 0, conflicts: 0 };
  }

  status() {
    return {
      running: this.running,
      line: this.cursor,
      total: this.events.length,
      stats: { ...this.stats },
    };
  }

  private async run() {
    this.processing = true;
    try {
      while (this.running && this.cursor < this.events.length) {
        const event = this.events[this.cursor];
        if (!event) {
          break;
        }

        try {
          const result = await this.ingest(event);
          this.cursor += 1;
          this.stats.accepted += result.accepted;
          this.stats.duplicates += result.duplicates;
          this.stats.rejected += result.rejected;
          this.stats.conflicts += result.summary?.conflicts ?? 0;
          this.report({
            line: this.cursor,
            total: this.events.length,
            eventId:
              typeof event.eventId === 'string' ? event.eventId : '(unknown)',
            stats: { ...this.stats },
            errors: result.errors,
          });
        } catch (error) {
          this.running = false;
          this.reportError(
            `Transport error at line ${this.cursor + 1}; replay paused: ${error instanceof Error ? error.message : String(error)}`,
          );
          break;
        }

        if (this.running && this.cursor < this.events.length) {
          await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
        }
      }
    } finally {
      this.processing = false;
      if (this.cursor === this.events.length && this.running) {
        this.running = false;
        this.reportError('Replay complete.');
      }
    }
  }
}
