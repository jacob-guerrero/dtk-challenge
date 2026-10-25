export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'FleetPulse API',
    version: '0.1.0',
  },
  paths: {
    '/api/events/batch': {
      post: {
        summary: 'Ingest a batch of telemetry events',
        parameters: [
          {
            name: 'X-API-Key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'Per-event ingestion results' } },
      },
    },
    '/api/vehicles': {
      get: {
        summary: 'List current vehicle state',
        responses: { '200': { description: 'Vehicles' } },
      },
    },
    '/api/vehicles/{vehicleId}/events': {
      get: {
        summary: 'List event history for a vehicle',
        responses: { '200': { description: 'Events' } },
      },
    },
    '/api/alerts': {
      get: {
        summary: 'List overspeed alerts',
        responses: { '200': { description: 'Alerts' } },
      },
    },
    '/api/health': {
      get: {
        summary: 'Check API and database health',
        responses: { '200': { description: 'Healthy' } },
      },
    },
  },
};
