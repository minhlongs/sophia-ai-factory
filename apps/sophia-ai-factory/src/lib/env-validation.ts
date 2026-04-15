/**
 * Environment variable validation using Zod.
 * Import this module early to surface missing config at startup.
 *
 * Usage:
 *   import { getValidatedEnv } from '@/lib/env-validation';
 *   const env = getValidatedEnv();
 *   env.BETTER_AUTH_SECRET // typed string
 */

import { z } from 'zod';

const envSchema = z.object({
  // Required for core operation
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),

  // Optional — validated if present
  OPENROUTER_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  DID_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  NOWPAYMENTS_API_KEY: z.string().optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_USER: z.string().optional(),
  ADMIN_PASS: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  HEALTH_CHECK_SECRET: z.string().optional(),
  API_KEY_SECRET: z.string().optional(),
  ADMIN_TELEGRAM_CHAT_ID: z.string().optional(),

  // URLs — validated as URL format if present
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _validated: Env | null = null;

/**
 * Returns validated environment variables.
 * Logs warnings on missing/invalid vars but does not throw —
 * CF Workers may have vars injected differently than process.env.
 */
export function getValidatedEnv(): Env {
  if (_validated) return _validated;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.warn('[env-validation] Missing or invalid environment variables:');
    for (const issue of result.error.issues) {
      console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    // Fall through with raw process.env — don't block startup
    _validated = process.env as unknown as Env;
  } else {
    _validated = result.data;
  }

  return _validated;
}
