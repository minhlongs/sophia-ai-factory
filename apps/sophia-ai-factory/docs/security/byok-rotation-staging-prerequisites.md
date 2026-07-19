# BYOK Rotation Staging Prerequisites

> What you need before running `scripts/test/rotation-staging-smoke.mjs`.
> Last updated: 2026-07-15

---

## 1. Staging Environment Must Exist

**Verify staging is deployed and healthy:**

```bash
curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/health
# Expected: HTTP 200
```

If the endpoint returns anything other than 200, deploy staging first:

```bash
cd apps/sophia-ai-factory
npm run deploy:staging
```

### Staging D1 Database: `sophia-raas-db-staging`

| Resource | Name | CF ID |
|---|---|---|
| App D1 | `sophia-raas-db-staging` | `bf74b301-7bb4-441f-9960-c96244b82953` |

**This should already exist** since staging was created on 2026-05-17. Confirm:

```bash
npx wrangler d1 list --config wrangler.staging.toml
# Look for sophia-raas-db-staging in the output
```

**If the DB does NOT exist** (e.g., staging was torn down), recreate it:

```bash
# 1. Create D1 database
npx wrangler d1 create sophia-raas-db-staging --config wrangler.staging.toml

# 2. Note the new database_id from the output, then update wrangler.staging.toml:
#    [[d1_databases]]
#    binding = "DB"
#    database_name = "sophia-raas-db-staging"
#    database_id = "<new-id>"

# 3. Apply all migrations
bash scripts/apply-migrations.sh --config wrangler.staging.toml

# 4. Re-deploy staging
npm run deploy:staging
```

### Required D1 Migration

Migration `0184_key_versions.sql` must be applied. It creates the `key_versions` table and adds `key_version` columns to `user_api_keys`, `user_provider_credentials`, and `platform_credentials`.

```bash
# Verify the table exists:
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='key_versions'"
# Expected: 1 row with name='key_versions'
```

---

## 2. Staging Secrets Must Be Set

Run these once (or when secrets expire):

```bash
cd apps/sophia-ai-factory

# Required for worker boot:
npx wrangler secret put BETTER_AUTH_SECRET --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put JWT_SECRET=REDACTED --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put CRON_SECRET --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put BYOK_MASTER_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put API_ENCRYPTION_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put CREDENTIALS_MASTER_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging

# For the smoke test's provider ping step (use real test key):
npx wrangler secret put OPENROUTER_TEST_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging
```

**BYOK_MASTER_KEY** must be a base64-encoded 32-byte value. Generate one locally:

```bash
node -e "console.log(btoa(Array.from(crypto.getRandomValues(new Uint8Array(32)), b => String.fromCharCode(b)).join('')))"
```

**BETTER_AUTH_SECRET** must be at least 32 characters:

```bash
openssl rand -base64 32
```

---

## 3. Test Admin User Must Exist

You need a user with admin role on staging. Create one if it does not exist.

### Option A: Create via staging UI (easiest)

1. Open `https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/sign-up`
2. Register with email + password
3. Promote to admin via D1:

```bash
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "UPDATE users SET role = 'admin' WHERE email = '<your-email>'"
```

### Option B: Create directly via D1 (if auth is broken)

```bash
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "INSERT INTO users (id, email, email_verified, role, created_at, updated_at)
    VALUES (lower(hex(randomblob(16))), 'admin@test.com', 1, 'admin', datetime('now'), datetime('now'))"
```

Then set the password by hitting the sign-up endpoint on staging (which will both-hash and store it):

```bash
# Use the sign-in endpoint with an initial password reset, or wire up Better Auth
# to create the credential. The exact flow depends on whether Better Auth
# clients are compiled into the staged build.
```

---

## 4. Admin Challenge Token (Re-Auth Gate)

The rotation endpoint (`/api/admin/keys/rotate`) requires:

1. Admin role in DB (verified via `isUserAdmin`)
2. Valid `admin_challenge_token` cookie (HMAC-signed, max age 5 minutes)

The smoke test automates both by:

- Logging in via `/api/auth/sign-in/email` to obtain a session
- Calling `/api/auth/admin-challenge` to mint the challenge token

**If `/api/auth/admin-challenge` requires a password re-entry on staging**, the smoke test will warn and continue (some environments skip the password step when the session is fresh).

---

## 5. wrangler CLI

Ensure you have the correct wrangler version matching the project:

```bash
npx wrangler --version
```

You must be logged in to the same Cloudflare account that owns staging:

```bash
npx wrangler whoami
# Expected: billwill.mentor@gmail.com (or the account that owns staging)
```

---

## 6. No Censored Secrets in Script Output

The smoke test logs key versions and counts only. It never prints:
- Plaintext API keys
- `BYOK_MASTER_KEY` value
- Session tokens (beyond cookie jar names)

If you add debug logging, ensure `console.log` statements never leak credentials.

---

## Quick Verification Checklist

```bash
# 1. Staging healthy?
curl -s https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/api/health

# 2. key_versions table exists?
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "SELECT COUNT(*) AS cnt FROM key_versions"

# 3. Admin user exists?
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 5"

# 4. Secrets set?
npx wrangler secret list --name sophia-ai-factory-staging
# Should include: BETTER_AUTH_SECRET, BYOK_MASTER_KEY, JWT_SECRET=REDACTED, CRON_SECRET

# 5. BYOK_MASTER_KEY is valid 32-byte base64?
npx wrangler secret list --name sophia-ai-factory-staging | grep BYOK
# (Cannot verify value, but presence confirms it was set)
```

If all five checks pass, you are ready to run the smoke test.
