# Secret Rotation Runbook

> Operator guide for rotating encryption keys and API secrets in Sophia AI Factory.
> Covers Tier-1 encryption keys (session, credentials, audit, webhooks) and integration secrets.
> Effective: 2026-05-23

---

## Tier-1 Encryption Keys (Session, Credentials, Audit)

These keys encrypt sensitive data at rest or in transit. **Rotation invalidates or requires re-encryption.**

### 1. BETTER_AUTH_SECRET (Session Signing Key)

**What it protects:** User session tokens (JWT), password reset tokens, admin auth tokens, OpenClaw agent tokens

**When to rotate:**
- Suspected compromise (session hijacking, token leak in logs)
- Operator handover / access revocation
- Scheduled: every 90 days

**Rotation impact:** ⚠️ **INVALIDATES ALL ACTIVE SESSIONS**
- All logged-in users will be signed out
- Password reset links in-flight expire (15-min TTL anyway)
- OpenClaw agent tokens expire (1-hour TTL anyway)

**Steps:**

```bash
# Step 1: Generate new 32+ character random secret
NEW_SECRET=$(openssl rand -base64 32)
echo "New secret: $NEW_SECRET"

# Step 2: Update Cloudflare Worker secret
npx wrangler secret put BETTER_AUTH_SECRET --name sophia-ai-factory
# Paste the NEW_SECRET when prompted

# Step 3: Verify new secret is live
npx wrangler tail --name sophia-ai-factory | grep -i "better.auth\|session"

# Step 4: Verify all users see login required (expected behavior)
# Open https://sophia.agencyos.network/dashboard in incognito window
# Should redirect to /login (session cookies now invalid)

# Step 5: Test new sessions
# Log in manually, verify dashboard loads
# Check Sentry for absence of "invalid token" errors

# Step 6: Document rotation
# Record in docs/project-changelog.md: date, reason, rotation_id (you generate UUID)
# NEVER record the secret itself
```

**Verification:**
```bash
# In Sentry, filter by "BETTER_AUTH" errors for 30 min post-rotation
# Expected: 0 errors (all new sessions use new secret)
```

---

### 2. API_ENCRYPTION_KEY (Encrypted Data at Rest)

**What it protects:** Sensitive fields encrypted in D1 database (e.g., customer API keys stored in `user_api_keys` table)

**When to rotate:**
- Suspected compromise of encryption key
- Scheduled: every 180 days

**Rotation impact:** ⚠️ **REQUIRES RE-ENCRYPTING ALL STORED DATA**

**Steps:**

```bash
# Step 1: Back up current encrypted data
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT * FROM user_api_keys LIMIT 100" > /tmp/backup_before_rotation.json

# Step 2: Generate new 32-byte base64 key
NEW_KEY=$(openssl rand 32 | base64)
echo "New key (base64): $NEW_KEY"

# Step 3: Create re-encryption script
# Save as scripts/rotate-api-encryption-key.ts (example below)
cat > scripts/rotate-api-encryption-key.ts << 'EOF'
import { createServerClient } from '@/seed/db/client';

const oldKey = process.env.API_ENCRYPTION_KEY;
const newKey = process.env.NEW_API_ENCRYPTION_KEY;

if (!oldKey || !newKey) {
  throw new Error('Both API_ENCRYPTION_KEY and NEW_API_ENCRYPTION_KEY required');
}

const db = createServerClient();
const rows = db.prepare('SELECT id, encrypted_value FROM user_api_keys WHERE encrypted_value IS NOT NULL').all();

for (const row of rows) {
  // Decrypt with old key
  const decrypted = decrypt(row.encrypted_value, oldKey);
  // Re-encrypt with new key
  const reencrypted = encrypt(decrypted, newKey);
  // Update DB
  db.prepare('UPDATE user_api_keys SET encrypted_value = ? WHERE id = ?')
    .run(reencrypted, row.id);
}

console.log(`✅ Re-encrypted ${rows.length} records`);
EOF

# Step 4: Run re-encryption (must be done offline or during maintenance window)
# For now, manual update via wrangler shell (simpler, but slower)
# OR schedule a D1 maintenance script

# Step 5: Update Cloudflare secret
npx wrangler secret put API_ENCRYPTION_KEY --name sophia-ai-factory
# Paste NEW_KEY when prompted

# Step 6: Verify new key works
# Test: create new API key entry, verify encryption/decryption works

# Step 7: Document
echo "API_ENCRYPTION_KEY rotation at $(date -u +%Y-%m-%d)" >> docs/project-changelog.md
```

**Verification:**
```bash
# Query encrypted values in D1 — should all decrypt correctly with new key
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) FROM user_api_keys WHERE encrypted_value IS NOT NULL"
# Count should match pre-rotation count
```

---

### 3. BYOK_MASTER_KEY (Customer API Key Wrapping)

**What it protects:** Customers' Bring-Your-Own-Keys (BYOK) for OpenRouter, ElevenLabs, D-ID, etc.

**When to rotate:**
- Suspected compromise
- Scheduled: every 180 days

**Rotation impact:** ⚠️ **REQUIRES RE-WRAPPING ALL CUSTOMER KEYS**

**Steps:**

```bash
# Same flow as API_ENCRYPTION_KEY
# 1. Backup current keys
# 2. Generate new 32-byte base64 key
# 3. Re-wrap all keys in `user_api_keys` table (marked with `provider` field)
# 4. Update secret
# 5. Test BYOK functionality (Setup Wizard → add new key → verify it works)
```

**Verification:**
```bash
# All existing BYOK keys should still validate against actual APIs
# Test: Setup Wizard BYOK edit page → click "test" on existing key → should work
```

---

### 4. CREDENTIALS_MASTER_KEY (OAuth Token Encryption)

**What it protects:** OAuth tokens (TikTok, YouTube, Reddit, etc.) encrypted in `oauth_credentials` table

**When to rotate:**
- Suspected OAuth token compromise
- Scheduled: every 180 days

**Rotation impact:** ⚠️ **REQUIRES RE-ENCRYPTING ALL STORED TOKENS**

**Steps:**

```bash
# Same re-encryption flow as API_ENCRYPTION_KEY
# 1. Backup `SELECT * FROM oauth_credentials`
# 2. Generate new key
# 3. Decrypt all tokens with old key, re-encrypt with new
# 4. Update secret
# 5. Test: Try publishing to TikTok/YouTube → should succeed
```

---

### 5. OAUTH_TOKEN_ENC_KEY (AES-256-GCM Token Encryption)

**What it protects:** OAuth tokens encrypted with AES-256-GCM (alternative to CREDENTIALS_MASTER_KEY)

**When to rotate:** Same as CREDENTIALS_MASTER_KEY

**Rotation impact:** ⚠️ **INVALIDATES ALL OAUTH_TOKEN_ENC_IV VALUES IN DB** (initialization vectors become useless)

**Steps:**

```bash
# Same flow as CREDENTIALS_MASTER_KEY
# Special note: Delete old IV values after re-encryption (they're tied to old key)
npx wrangler d1 execute sophia-raas-db --remote \
  --command "UPDATE oauth_tokens SET oauth_token_enc_iv = NULL"
# Then update values with new re-encrypted tokens
```

---

### 6. AUDIT_RECEIPT_SECRET (Audit Log Tamper-Proofing)

**What it protects:** HMAC signatures on audit log entries (prevents tampering)

**When to rotate:**
- Suspected audit log compromise
- Scheduled: every 12 months

**Rotation impact:** ⚠️ **BREAKS VERIFICATION OF HISTORICAL AUDIT ENTRIES**
- After rotation, old audit log signatures cannot be verified
- New entries will use new key
- Consider this before rotating

**Steps:**

```bash
# Step 1: Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Step 2: Back up current audit logs
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10000" > /tmp/audit_backup.json

# Step 3: Update secret
npx wrangler secret put AUDIT_RECEIPT_SECRET --name sophia-ai-factory
# Paste NEW_SECRET when prompted

# Step 4: Document rotation in audit log itself (philosophical)
# INSERT INTO audit_logs (actor, action, resource_id, resource_type, timestamp)
# VALUES ('system', 'AUDIT_SECRET_ROTATED', '<rotation_id>', 'audit_system', unixepoch())

# Step 5: Test
# Create new audit entry, verify signature is computable with new key
```

**Verification:**
```bash
# Old audit entries won't verify, but that's expected (logged for compliance)
# New entries should all verify correctly
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) FROM audit_logs WHERE created_at > unixepoch() - 3600"
# Should have new entries since rotation
```

---

### 7. STRIPE_CONNECT_WEBHOOK_SECRET (Stripe Webhook HMAC)

**What it protects:** Inbound webhook signature from Stripe (prevents spoofing)

**When to rotate:**
- Suspected webhook spoofing / MITM
- Scheduled: every 12 months

**Rotation impact:** ⚠️ **BRIEF PERIOD WHERE BOTH OLD + NEW SIGNATURES ACCEPTED**

**Steps:**

See `docs/stripe-connect-operations.md` (Section: "Secret Rotation Procedure") for detailed steps.

Quick summary:
```bash
# 1. Stripe Dashboard → Developers → Webhooks → endpoint → "Roll signing secret"
# 2. npx wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET --name sophia-ai-factory
# 3. Paste new secret when prompted
# 4. Test webhook from Stripe Dashboard
# 5. Wait 24h (Stripe retries old-signed events)
# 6. Confirm no signature failures in logs after 24h
```

---

## Tier-2 Integration Secrets (API Keys)

These are third-party API credentials. **Rotation doesn't invalidate cached data.**

### STRIPE_SECRET_KEY (Stripe API Authentication)

**What it protects:** Read/write access to Stripe API (Connect accounts, transfers)

**When to rotate:**
- Suspected compromise (key leaked in logs, error messages)
- Operator handover
- Scheduled: every 12 months

**Rotation steps:**

```bash
# Step 1: Generate new restricted API key in Stripe
# Dashboard → Developers → API keys → "Create restricted key"
# Scopes: Connect (read + write)

# Step 2: Update Cloudflare secret
npx wrangler secret put STRIPE_SECRET_KEY --name sophia-ai-factory
# Paste new key when prompted

# Step 3: Test Stripe Connect flow
# Create test affiliate user → Start onboarding → Verify no auth errors

# Step 4: Monitor logs
npx wrangler tail --name sophia-ai-factory | grep -i "stripe\|unauthorized"
# Expected: 0 auth errors

# Step 5: Revoke old key in Stripe
# Dashboard → API keys → old key → "Revoke"
```

**Verification:**
```bash
# Test: Affiliate account creation should work
curl -X POST https://sophia.agencyos.network/api/connect/onboard \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","country":"US"}'
# Should return 200 with account link URL
```

---

### NOWPAYMENTS_API_KEY & NOWPAYMENTS_IPN_SECRET

See `docs/nowpayments-key-rotation.md` for detailed procedures.

Quick steps:
```bash
# 1. Generate new keys in NOWPayments console
# 2. Update both secrets via wrangler
# 3. Deploy with npm run deploy:full
# 4. Monitor payment webhooks for 24h
# 5. Revoke old keys in NOWPayments
```

---

### PAYOUT_ENC_KEY (Encrypted Crypto Address Storage)

**What it protects:** NOWPayments wallet addresses (encrypted before storage in D1)

**When to rotate:**
- Suspected address compromise (e.g., phishing link with old address)
- Scheduled: every 12 months

**Rotation impact:** ⚠️ **REQUIRES RE-ENCRYPTING ALL STORED ADDRESSES**

**Steps:**

```bash
# Same flow as API_ENCRYPTION_KEY
# 1. Backup: SELECT * FROM payout_methods WHERE wallet_address IS NOT NULL
# 2. Generate new key
# 3. Re-encrypt all wallet addresses
# 4. Update secret
# 5. Test: Payout batch creation should still route to correct wallets
```

---

## Shared Rotation Procedures

### Pre-Rotation Checklist

```bash
# 1. Verify current secrets are wired (shows [REDACTED])
npx wrangler secret list --name sophia-ai-factory

# 2. Check git status is clean
git status
git log --oneline -1

# 3. Verify production is running current commit
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
git rev-parse HEAD | cut -c1-8
# Both should match

# 4. Snapshot metrics before rotation (payment count, audit log count, etc.)
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) FROM payment_events WHERE created_at > unixepoch() - 86400"
```

### Post-Rotation Checklist

```bash
# 1. Deploy changes
npm run deploy:full

# 2. Verify deploy SHA
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ Deploy verified" || { echo "❌ Stale"; exit 1; }

# 3. Monitor logs for 30 minutes
npx wrangler tail --name sophia-ai-factory --format pretty | head -100

# 4. Check for errors in Sentry related to the key that was rotated
# Filter by tag:<secret-name> (e.g., tag:BETTER_AUTH_SECRET)

# 5. Verify metrics unchanged
# Re-run snapshot query; should show same or greater count (no data loss)

# 6. Document rotation
# Record in docs/project-changelog.md: date, secret, reason, status (success/rollback)
```

### Rollback Procedure

If rotation causes widespread failures:

```bash
# Step 1: Restore old secret value
npx wrangler secret put <SECRET_NAME> --name sophia-ai-factory
# Paste OLD value when prompted

# Step 2: Redeploy
npm run deploy:full

# Step 3: Verify
curl -s https://sophia.agencyos.network/api/version | jq .shortSha

# Step 4: Investigate what went wrong before next rotation
# Check Sentry logs, D1 schema, code paths
```

---

## Rotation Schedule

| Secret | Interval | Owner | Last Rotated |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | 90 days | Platform | — |
| `API_ENCRYPTION_KEY` | 180 days | Platform | — |
| `BYOK_MASTER_KEY` | 180 days | Platform | — |
| `CREDENTIALS_MASTER_KEY` | 180 days | Platform | — |
| `OAUTH_TOKEN_ENC_KEY` | 180 days | Platform | — |
| `AUDIT_RECEIPT_SECRET` | 12 months | Compliance | — |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | 12 months | Platform | — |
| `STRIPE_SECRET_KEY` | 12 months | Platform | — |
| `NOWPAYMENTS_API_KEY` | 12 months | Platform | — |
| `NOWPAYMENTS_IPN_SECRET` | 12 months | Platform | — |
| `PAYOUT_ENC_KEY` | 12 months | Platform | — |

> **TODOS:** Implement calendar reminder system for scheduled rotations (Slack bot, GitHub issue auto-creation, etc.)

---

## Security Notes

- **NEVER commit secrets to git** — pre-push hook (`secretlint`) is a safeguard but not infallible
- **NEVER share secrets via email, chat, or screenshots** — use `wrangler secret put` interactive prompt only
- **NEVER reuse secrets across environments** — staging/prod must have distinct keys
- **Log rotations in `docs/project-changelog.md`** with date, secret name, reason, and status (never the secret value itself)

---

## References

- `docs/stripe-connect-operations.md` — Stripe webhook secret rotation (detailed)
- `docs/nowpayments-key-rotation.md` — NOWPayments secret rotation (detailed, bilingual)
- `docs/SECURITY.md` — Vulnerability disclosure policy, incident reporting
- `docs/payout-operations-runbook.md` — Payout infrastructure & Stripe Connect troubleshooting
- Cloudflare Wrangler docs: https://developers.cloudflare.com/workers/cli-wrangler/

---

## Unresolved

- No automated key rotation framework (e.g., HashiCorp Vault, AWS Secrets Manager)
  - Manual rotation via `wrangler secret put` only
  - No automatic re-encryption of dependent data (requires custom scripts)
- No centralized secret audit log beyond D1 `audit_logs` table
  - Rotation is logged but not cryptographically signed with old key first (order matters)
- No secret versioning (only one active secret per name in Cloudflare)
  - N-version support would allow gradual key rollout without re-encryption

