import { describe, expect, it } from 'vitest';
import {
  parseJsonLines,
  ReplayController,
  type ReplayEvent,
} from './replay.js';

describe('parseJsonLines', () => {
  it('preserves fixture line order', () => {
    const events = parseJsonLines('{"eventId":"E-002"}\n{"eventId":"E-001"}\n');

    expect(events.map((event) => event.eventId)).toEqual(['E-002', 'E-001']);
  });
});

describe('ReplayController', () => {
  it('starts from the first record and accumulates each API response', async () => {
    const sent: ReplayEvent[] = [];
    const reports: Array<{ line: number; eventId: string }> = [];
    const controller = new ReplayController(
      [{ eventId: 'E-001' }, { eventId: 'E-002' }],
      0,
      async (event) => {
        sent.push(event);
        return { accepted: 1, duplicates: 0, rejected: 0, errors: [] };
      },
      (progress) =>
        reports.push({ line: progress.line, eventId: progress.eventId }),
      () => undefined,
    );

    await controller.start();

    expect(sent.map((event) => event.eventId)).toEqual(['E-001', 'E-002']);
    expect(reports).toEqual([
      { line: 1, eventId: 'E-001' },
      { line: 2, eventId: 'E-002' },
    ]);
    expect(controller.status()).toMatchObject({
      running: false,
      line: 2,
      stats: { accepted: 2, duplicates: 0, rejected: 0, conflicts: 0 },
    });
  });
});
