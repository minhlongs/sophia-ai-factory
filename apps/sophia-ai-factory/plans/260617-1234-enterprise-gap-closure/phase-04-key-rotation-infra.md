# Phase 04 — Key Rotation Infrastructure

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Security category)
- Related: V-2.1 AES-GCM AAD fix already shipped; this extends to rotation capability
- Related: Phase 1 (SOC 2) needs key access audit; this phase provides rotation audit trail

## Overview

- **Priority:** P1 (depends on Phase 1 SoD controls)
- **Status:** pending
- **Description:** Implement cryptographic key rotation infrastructure for BYOK-stored credentials (OpenRouter, ElevenLabs, D-ID, HeyGen). Support versioned keys with dual-decrypt window to allow gradual rotation without downtime. Document and test runbook.

## Key Insights

- Current BYOK store (`src/tree/byok/`) encrypts keys with AES-GCM using a master key derived from `ENCRYPTION_KEY` env var
- V-2.1 fixed the AES-GCM AAD to bind ciphertext to userId (tenant isolation)
- No rotation mechanism exists — changing master key requires decrypt+reencrypt all stored credentials (downtime risk)
- Enterprise security standard: keys should rotate on 90-day cadence; compromise recovery requires rotation capability

## Requirements

### Functional
1. **Versioned key storage** — `user_api_keys` and `user_provider_credentials` tables add `key_version` column (default 1)
2. **Dual-decrypt window** — System can decrypt keys from current version AND previous version during rotation period (default 7 days)
3. **Rotation trigger** — Admin UI or API endpoint to initiate rotation for a user or org-wide
4. **Re-encryption job** — Background job that re-encrypts all keys with new key version (batched to avoid memory blowup)
5. **Key version lifecycle** — Old versions marked `retired` after dual-decrypt window; only current version used for new encrypts

### Non-functional
- Rotation re-encrypt must not block DB (batch size 100, async job)
- Dual-decrypt lookup overhead < 5ms per key fetch
- Key version history retention: keep last 2 versions active, archive older to cold storage
- Runbook must be testable by second operator without downtime

## Architecture

### Database Schema Changes

```sql
-- migrations/0122-user-api-keys-key-version.sql
ALTER TABLE user_api_keys ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_provider_credentials ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1;

-- migrations/0123-key-versions-table.sql
CREATE TABLE key_versions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  retired_at INTEGER,
  key_derivation_salt TEXT NOT NULL, -- base64
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'retired'
  UNIQUE(version, status) -- only one active version at a time
);

INSERT INTO key_versions (id, version, created_at, key_derivation_salt, status)
VALUES ('master-key', 1, strftime('%s', 'now'), '<derived from ENCRYPTION_KEY>', 'active');
```

### Dual-Decrypt Logic

```typescript
// src/tree/byok/byok-crypto.ts (extended)
interface KeyVersion {
  version: number;
  salt: string; // base64
  status: 'active' | 'retired';
}

async function getActiveKeyVersions(): Promise<KeyVersion[]> {
  const db = createServerClient();
  const { data } = await db
    .from('key_versions')
    .select('version, salt, status')
    .in_('status', ['active', 'retired'])
    .order('version', { ascending: false })
    .limit(2); // current + previous for dual-decrypt window

  return data as KeyVersion[];
}

async function decryptWithVersions(ciphertext: string, userId: string): Promise<string> {
  const versions = await getActiveKeyVersions();
  const { createHash } = await import('crypto');

  for (const v of versions) {
    const keyMaterial = deriveKeyFromSalt(v.salt, userId); // AAD=userId as per V-2.1
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial, ivFromCiphertext(ciphertext));
    decipher.setAuthTag(tagFromCiphertext(ciphertext));
    decipher.setAAD(new TextEncoder().encode(userId));

    try {
      let plaintext = decipher.update(ciphertext);
      plaintext += decipher.final();
      return plaintext; // success with this version
    } catch {
      // Wrong key version, try next
      continue;
    }
  }

  throw new Error('Failed to decrypt with any active key version');
}
```

### Rotation Trigger API

```typescript
// src/app/api/admin/keys/rotate/route.ts
export const POST = withAuth(async (req: Request, { user }: { user: User }) => {
  // Authorization: only super-admin users (role='admin')
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { scope, userId } = await req.json(); // scope: 'user' | 'org' | 'global'

  // 1. Generate new key version
  const newSalt = crypto.randomBytes(32).toString('base64');
  const newVersion = await createKeyVersion(newSalt); // inserts into key_versions

  // 2. Queue re-encryption job (Inngest)
  await enqueue(inngest, {
    name: 'key/rotate',
    data: { scope, userId, newVersion, oldVersion: currentVersion },
  }, { id: `rotate-${scope}-${userId || 'global'}-${Date.now()}` });

  return NextResponse.json({ version: newVersion, status: 'reencrypt_queued' });
});
```

### Re-encryption Job (Inngest)

```typescript
// src/forest/inngest/functions/key-rotation-reencrypt.ts
export const keyRotationReencrypt = inngest.createFunction(
  { id: 'key-rotation-reencrypt' },
  { event: 'key/rotate' },
  async ({ event, step }) => {
    const { scope, userId, newVersion } = event.data;

    // Fetch keys in batches of 100
    const batchSize = 100;
    let offset = 0;
    let totalProcessed = 0;

    while (true) {
      const keys = await step.run('fetch-batch', async () => {
        const db = createServerClient();
        const query = db.from('user_api_keys')
          .select('id, encrypted_key, key_version')
          .eq('key_version', event.data.oldVersion);
        if (scope === 'user' && userId) {
          query.eq('user_id', userId);
        }
        query.range(offset, offset + batchSize);
        return (await query) as { id: string; encrypted_key: string; key_version: number }[];
      });

      if (keys.length === 0) break;

      // Re-encrypt each key
      for (const key of keys) {
        const plaintext = await decryptWithVersions(key.encrypted_key, key.user_id);
        const newCiphertext = await encryptWithVersion(plaintext, key.user_id, newVersion);

        await step.run('update-key', async () => {
          const db = createServerClient();
          await db.from('user_api_keys')
            .update({ encrypted_key: newCiphertext, key_version: newVersion })
            .eq('id', key.id);
        });
      }

      totalProcessed += keys.length;
      offset += batchSize;
    }

    // After all keys re-encrypted, retire old version
    await step.run('retire-old-version', async () => {
      const db = createServerClient();
      await db.from('key_versions')
        .update({ retired_at: Math.floor(Date.now() / 1000) })
        .eq('version', event.data.oldVersion);
    });

    return { totalProcessed, newVersion };
  }
);
```

### Runbook (`docs/runbooks/KEY-ROTATION.md`)

Sections:
1. **Pre-rotation checklist** — backup DB, notify affected users (if scoped), schedule maintenance window
2. **Rotation steps** — POST to `/api/admin/keys/rotate`; monitor Inngest job progress
3. **Verification** — Spot-check keys have new `key_version`; test decryption of rotated keys
4. **Rollback** — If errors > threshold, halt rotation; old version still active
5. **Post-rotation** — After dual-decrypt window expires, clean up old version data (archive to R2)

## Related Code Files

**Files to create:**
- `migrations/0122-user-api-keys-key-version.sql`
- `migrations/0123-key-versions-table.sql`
- `src/tree/byok/byok-crypto.ts` — add versioned decrypt + encrypt
- `src/forest/inngest/functions/key-rotation-reencrypt.ts`
- `src/app/api/admin/keys/rotate/route.ts`
- `scripts/inngest/trigger-key-rotation.js` (manual trigger utility)
- `docs/runbooks/KEY-ROTATION.md`

**Files to modify:**
- `src/tree/credentials/encryption.ts` — use versioned decrypt
- `src/app/actions/settings/save-api-keys/` — set key_version=current on new encrypts
- `src/seed/auth/better-auth-session.ts` — add admin role check for rotation endpoint
- `scripts/apply-migrations.sh` — ensure new migrations are applied

## Implementation Steps

1. **Design review** — Confirm dual-decrypt window duration (7 days recommended) with security team
2. **Create migrations** — `0122`, `0123`; test on staging with data migration script
3. **Implement key version management** — `getActiveKeyVersions()`, `createKeyVersion()`
4. **Extend BYOK crypto** — Update `decryptWithVersions()`, `encryptWithVersion()`
5. **Build rotation API** — admin endpoint with authorization
6. **Build Inngest re-encrypt job** — batch processing with error handling (skip bad keys, continue)
7. **Create manual trigger script** — `trigger-key-rotation.js` for operator use
8. **Write runbook** — step-by-step with rollback instructions
9. **Test rotation on staging** — End-to-end: trigger → batch → verify
10. **Audit logging integration** — Ensure all rotation actions log to `audit_log` (Phase 1)
11. **Second-operator drill** — Have different operator execute runbook from fresh clone

## Todo List

- [ ] Confirm dual-decrypt window duration (7 days?)
- [ ] Write and test `0122` + `0123` migrations on staging
- [ ] Implement `getActiveKeyVersions()` and `createKeyVersion()`
- [ ] Extend `byok-crypto.ts` with versioned decrypt/encrypt
- [ ] Create admin rotation API with role-based access control
- [ ] Build Inngest re-encrypt function with batch processing
- [ ] Write `docs/runbooks/KEY-ROTATION.md`
- [ ] Test full rotation flow on staging with 1000+ test keys
- [ ] Integrate with Phase 1 audit logging
- [ ] Document runbook; train second operator
- [ ] Execute first production rotation (test user) as validation

## Success Criteria

- ✅ `key_versions` table with version tracking and `retired_at` field
- ✅ `user_api_keys.key_version` and `user_provider_credentials.key_version` populated (all existing keys = version 1)
- ✅ Decryption works for both version 1 and version 2 during dual-decrypt window
- ✅ Rotation API returns job ID and queues Inngest job
- ✅ Re-encrypt job processes batches; handles errors gracefully; updates `key_version`
- ✅ Runbook documented with rollback steps
- ✅ Second operator successfully executes rotation on staging
- ✅ All rotation actions logged to `audit_log` (Phase 1)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Re-encrypt job times out (Inngest 60s limit) | High | Med | Use `step.run()` with manual batching; resume logic |
| Dual-decrypt lookup adds >5ms per key fetch | Low | Low | Cache active versions in memory (15s TTL) |
| Rotation corrupts some keys | Med | High | Skip failed keys; continue; report errors for manual re-key |
| Old version retired too early breaks active sessions | High | High | Enforce dual-decrypt window (7 days) before retirement |
| Admin API unauthorized access | Low | Max | Strict role check; audit log all attempts |

## Security Considerations

- Key version salts stored in `key_versions` must be generated with `crypto.randomBytes(32)` and never reused
- Dual-decrypt window ensures backward compatibility but increases attack surface — keep window minimal (7 days)
- All rotation API calls must be logged to `audit_log` with operator identity
- Runbook access restricted to operators; stored in `docs/runbooks/` with Sensitive notice

## Next Steps

1. **Week 1-2:** Migrations + versioned crypto
2. **Week 3:** Rotation API + Inngest job
3. **Week 4:** Runbook + staging test
4. **Week 5:** SOC 2 evidence pack (link to rotation controls)
5. **Week 6:** Production trial rotation (low-risk user)
