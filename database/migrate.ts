import { Client } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationsDirectory = fileURLToPath(
  new URL('./migrations/', import.meta.url),
);
const migrationNamePattern = /^\d{3}_.+\.sql$/;

async function readMigrations() {
  const fileNames = (await readdir(migrationsDirectory))
    .filter((fileName) => migrationNamePattern.test(fileName))
    .sort();

  if (fileNames.length === 0) {
    throw new Error('No migration files found.');
  }

  return Promise.all(
    fileNames.map(async (fileName) => ({
      name: fileName,
      sql: await readFile(`${migrationsDirectory}${fileName}`, 'utf8'),
    })),
  );
}

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set.');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [814_092_601]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const appliedNames = new Set(
      applied.rows.map((migration) => migration.name),
    );

    for (const migration of await readMigrations()) {
      if (appliedNames.has(migration.name)) {
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          migration.name,
        ]);
        await client.query('COMMIT');
        console.log(`Applied ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [814_092_601]);
    await client.end();
  }
}

migrate().catch((error: unknown) => {
  console.error(
    'Migration failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
