import { Pool } from 'pg';
import { createAnswerGenerator } from './answer-generator.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const pool = new Pool({ connectionString: config.DATABASE_URL });
const app = createApp(
  pool,
  config.INGEST_API_KEY,
  createAnswerGenerator({
    provider: config.LLM_PROVIDER,
    geminiApiKey: config.GEMINI_API_KEY,
    geminiModel: config.GEMINI_MODEL,
  }),
);

const server = app.listen(config.PORT, () => {
  console.log(`FleetPulse API listening on port ${config.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
