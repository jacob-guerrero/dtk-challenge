import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  parseJsonLines,
  ReplayController,
  type BatchResponse,
} from './replay.js';

const fixturePath = fileURLToPath(
  new URL(
    '../../docs/Paquete_Enviar_Prueba/kit_inicial/fixtures/events.jsonl',
    import.meta.url,
  ),
);
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
const ingestApiKey = process.env.INGEST_API_KEY;
const intervalMs = Number(process.env.REPLAY_INTERVAL_MS ?? 750);

if (!ingestApiKey) {
  throw new Error('INGEST_API_KEY must be set in .env.');
}
const apiKey = ingestApiKey;
if (!Number.isFinite(intervalMs) || intervalMs < 0) {
  throw new Error('REPLAY_INTERVAL_MS must be a non-negative number.');
}

async function ingest(event: Record<string, unknown>): Promise<BatchResponse> {
  const response = await fetch(`${apiBaseUrl}/api/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ events: [event] }),
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }
  return (await response.json()) as BatchResponse;
}

const events = parseJsonLines(await readFile(fixturePath, 'utf8'));
const controller = new ReplayController(
  events,
  intervalMs,
  ingest,
  ({ line, total, eventId, stats, errors }) => {
    const reasons = errors.map((error) => error.reason).join(', ');
    console.log(
      `line ${line}/${total} ${eventId} | accepted=${stats.accepted} duplicates=${stats.duplicates} rejected=${stats.rejected} conflicts=${stats.conflicts}${reasons ? ` errors=${reasons}` : ''}`,
    );
  },
  (message) => console.log(message),
);

const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
console.log(`Loaded ${events.length} events. Interval: ${intervalMs}ms.`);
console.log('Commands: start, pause, resume, restart, status, quit');

terminal.on('line', (line) => {
  switch (line.trim().toLowerCase()) {
    case 'start':
    case 'resume':
      void controller.start();
      break;
    case 'pause':
      controller.pause();
      console.log('Replay paused.');
      break;
    case 'restart':
      controller.restart();
      console.log('Replay reset to line 1; use start to run it.');
      break;
    case 'status': {
      const status = controller.status();
      console.log(
        `line ${status.line}/${status.total} | running=${status.running} accepted=${status.stats.accepted} duplicates=${status.stats.duplicates} rejected=${status.stats.rejected} conflicts=${status.stats.conflicts}`,
      );
      break;
    }
    case 'quit':
    case 'exit':
      terminal.close();
      break;
    default:
      console.log('Commands: start, pause, resume, restart, status, quit');
  }
});

terminal.on('close', () => {
  controller.pause();
  process.exit(0);
});
