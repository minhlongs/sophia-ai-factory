---
description: 🔍 Env Validate — Environment Variables, Schema Validation, Missing Keys
argument-hint: [--strict] [--schema=.env.schema]
---

**Think harder** để env validate: <$ARGUMENTS>

**IMPORTANT:** Environment variables PHẢI validate type, required, format.

## Env Schema

```typescript
// .env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  // Required
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),

  // Optional with defaults
  PORT: z.string().default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Conditional
  STRIPE_SECRET_KEY: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;
```

## Validation Script

```bash
#!/bin/bash
# scripts/validate-env.sh

set -e

echo "🔍 Validating environment variables..."

# Check required vars
REQUIRED_VARS=("DATABASE_URL" "API_KEY" "NODE_ENV")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  fi
done

# Check NODE_ENV value
if [[ ! "${NODE_ENV}" =~ ^(development|production|test)$ ]]; then
  echo "❌ NODE_ENV must be development, production, or test"
  exit 1
fi

# Check URL format
if [[ ! "${DATABASE_URL}" =~ ^postgres:// ]]; then
  echo "❌ DATABASE_URL must be a PostgreSQL URL"
  exit 1
fi

echo "✅ All environment variables valid"
```

## dotenv-x Validation

```bash
# === Load and Validate ===
node -r dotenv/config -e "
  const schema = require('./.env.schema');
  const result = schema.envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Env validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  console.log('✅ Env validation passed');
"
```

## Related Commands

- `/secret-detect` — Secret detection
- `/security-audit` — Security audit
- `/config-lint` — Config linting
