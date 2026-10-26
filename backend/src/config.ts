import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  INGEST_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LLM_PROVIDER: z.enum(['extractive', 'gemini']).default('extractive'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}
