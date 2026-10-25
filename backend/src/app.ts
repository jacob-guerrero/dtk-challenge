import { timingSafeEqual } from 'node:crypto';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { Pool } from 'pg';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './openapi.js';
import {
  batchSchema,
  eventIdFrom,
  getFailureReason,
  telemetryEventSchema,
  type EventFailureReason,
} from './telemetry.js';
import { TelemetryRepository } from './telemetry-repository.js';

type BatchResult = {
  index: number;
  eventId?: string;
  status: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED' | 'CONFLICT';
  reason?: EventFailureReason;
};

function apiKeyMatches(
  receivedKey: string | undefined,
  expectedKey: string,
): boolean {
  if (!receivedKey) {
    return false;
  }

  const received = Buffer.from(receivedKey);
  const expected = Buffer.from(expectedKey);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

function unauthorized(_request: Request, response: Response) {
  response.status(401).json({ error: 'UNAUTHORIZED' });
}

function malformedJson(
  error: Error & { type?: string },
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'MALFORMED_JSON' });
    return;
  }
  next(error);
}

function summarize(results: BatchResult[]) {
  const accepted = results.filter(
    (result) => result.status === 'ACCEPTED',
  ).length;
  const duplicates = results.filter(
    (result) => result.status === 'DUPLICATE',
  ).length;
  const conflicts = results.filter(
    (result) => result.status === 'CONFLICT',
  ).length;
  const rejected = results.filter(
    (result) => result.status === 'REJECTED' || result.status === 'CONFLICT',
  ).length;
  const errors = results
    .filter(
      (result): result is BatchResult & { reason: EventFailureReason } =>
        result.reason !== undefined,
    )
    .map(({ index, eventId, reason }) => ({ index, eventId, reason }));

  return {
    accepted,
    duplicates,
    rejected,
    errors,
    summary: { accepted, duplicates, conflicts, rejected },
    results,
  };
}

export function createApp(pool: Pool, ingestApiKey: string) {
  const app = express();
  const repository = new TelemetryRepository(pool);

  app.use(express.json({ limit: '256kb' }));
  app.get('/api/openapi.json', (_request, response) => response.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  app.get('/api/health', async (_request, response, next) => {
    try {
      await pool.query('SELECT 1');
      response.status(200).json({ status: 'ok', database: 'ok' });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/vehicles', async (request, response, next) => {
    try {
      const search =
        typeof request.query.search === 'string'
          ? request.query.search
          : undefined;
      response
        .status(200)
        .json({ vehicles: await repository.listVehicles(search) });
    } catch (error) {
      next(error);
    }
  });

  app.get(
    '/api/vehicles/:vehicleId/events',
    async (request, response, next) => {
      try {
        response.status(200).json({
          events: await repository.listVehicleEvents(request.params.vehicleId),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get('/api/alerts', async (_request, response, next) => {
    try {
      response.status(200).json({ alerts: await repository.listAlerts() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/events/batch', async (request, response, next) => {
    if (!apiKeyMatches(request.header('X-API-Key'), ingestApiKey)) {
      unauthorized(request, response);
      return;
    }

    const batch = batchSchema.safeParse(request.body);
    if (!batch.success) {
      response.status(400).json({ error: 'INVALID_BATCH' });
      return;
    }

    try {
      const results: BatchResult[] = [];
      for (const [index, input] of batch.data.events.entries()) {
        const parsedEvent = telemetryEventSchema.safeParse(input);
        if (!parsedEvent.success) {
          const eventId = eventIdFrom(input);
          results.push({
            index,
            status: 'REJECTED',
            reason: getFailureReason(input),
            ...(eventId === undefined ? {} : { eventId }),
          });
          continue;
        }

        const persisted = await repository.persist(parsedEvent.data);
        if (persisted.status === 'CONFLICT') {
          results.push({
            index,
            eventId: parsedEvent.data.eventId,
            status: 'CONFLICT',
            reason: 'EVENT_ID_CONFLICT',
          });
          continue;
        }

        results.push({
          index,
          eventId: parsedEvent.data.eventId,
          status: persisted.status,
        });
      }

      response.status(200).json(summarize(results));
    } catch (error) {
      next(error);
    }
  });

  app.use(malformedJson);
  app.use(
    (
      _error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      void _next;
      response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    },
  );

  return app;
}
