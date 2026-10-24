import { z } from 'zod';

const configSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    INGEST_API_KEY: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LLM_PROVIDER: z.enum(['extractive', 'gemini']).default('extractive'),
    GEMINI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((config, context) => {
    if (config.LLM_PROVIDER === 'gemini' && !config.GEMINI_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when LLM_PROVIDER=gemini',
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}
