import { z } from 'zod';

/**
 * Environment Configuration with Zod Validation
 * Validates all required environment variables at startup
 * Throws error if any required variable is missing or invalid
 */

const environmentSchema = z.object({
  // Next.js
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // NOWPayments (Primary payment provider)
  NOWPAYMENTS_API_KEY: z.string().min(1).optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().min(1).optional(),

  // PayOS (Vietnam domestic backup)
  PAYOS_CLIENT_ID: z.string().min(1).optional(),
  PAYOS_API_KEY: z.string().min(1).optional(),
  PAYOS_CHECKSUM_KEY: z.string().min(1).optional(),

  // Optional Services
  AIRTABLE_API_KEY: z.string().min(1).optional(),
  AIRTABLE_BASE_ID: z.string().min(1).optional(),
  HEYGEN_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Feature Flags
  NEXT_PUBLIC_MOCK_AI_SERVICES: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

let cachedEnv: Environment | null = null;

/**
 * Validates and returns environment configuration
 * Caches result after first validation
 * @throws {Error} If validation fails
 */
export const getEnvironmentConfig = (): Environment => {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = environmentSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      throw new Error(
        `Environment validation failed:\n${issues.join('\n')}`
      );
    }
    throw error;
  }
};

/**
 * Check if environment is production
 */
export const isProduction = (): boolean => {
  return getEnvironmentConfig().NODE_ENV === 'production';
};

/**
 * Check if environment is development
 */
export const isDevelopment = (): boolean => {
  return getEnvironmentConfig().NODE_ENV === 'development';
};

/**
 * Check if AI services are mocked
 */
export const isMockMode = (): boolean => {
  return getEnvironmentConfig().NEXT_PUBLIC_MOCK_AI_SERVICES === 'true';
};

export default getEnvironmentConfig;
