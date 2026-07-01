# Phase 04 — TDD: BYOK Rotation Integration Tests

**Priority:** P0 | **Effort:** 1.5h | **Status:** pending | **Depends on:** —

## Overview

BYOK key rotation has 8/8 unit tests passing. Add integration-level tests that verify the full rotation pipeline: admin API → Inngest event → re-encrypt → old version retirement → audit log chain.

## Current State

- `key-rotation.test.ts`: 8 unit tests (all pass) — tests individual functions in isolation with mocked D1/Inngest
- `keys/rotate/route.ts`: Admin API (120 LOC) — creates new key version, fires Inngest event, audit logs
- `key-rotation-reencrypt.ts`: Inngest function (275 LOC) — re-encrypts 3 credential types in batches, retires old version

## Gap: No integration test

Unit tests mock D1 and Inngest. Need integration test that:
1. Seeds test credentials with old key version
2. Calls rotation API
3. Runs Inngest handler
4. Verifies credentials re-encrypted with new version
5. Verifies old version retired
6. Verifies audit log entries

## Implementation Steps

### 1. Write integration test: full rotation pipeline (~45 min)

**File:** `src/tree/byok/key-rotation-integration.test.ts`

```typescript
describe('key-rotation integration', () => {
  it('full rotation pipeline: API → Inngest → re-encrypt → retire → audit', async () => {
    // 1. Seed test data: key_versions (v1 active)
    const db = getD1();
    await db.prepare('INSERT INTO key_versions ...').run();

    // 2. Seed encrypted credential with old version
    await db.prepare('INSERT INTO user_api_keys (..., key_version=1) ...').run();

    // 3. Call POST /api/admin/keys/rotate with admin auth
    const response = await POST(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.keyVersion).toBe(2);
    expect(body.oldVersion).toBe(1);

    // 4. Run Inngest handler (simulates what Inngest does)
    const inngestResult = await keyRotationReencrypt.handler({
      event: { data: { keyVersion: 2, oldVersion: 1 } }
    });
    expect(inngestResult.total).toBeGreaterThan(0);

    // 5. Verify credential re-encrypted with new version
    const updatedCred = await db.prepare(
      'SELECT key_version FROM user_api_keys WHERE ...'
    ).first();
    expect(updatedCred.key_version).toBe(2);

    // 6. Verify old version retired
    const oldVersionRow = await db.prepare(
      'SELECT is_active, rotated_at FROM key_versions WHERE version = 1'
    ).first();
    expect(oldVersionRow.is_active).toBe(0);
    expect(oldVersionRow.rotated_at).not.toBeNull();

    // 7. Verify audit log entries (2 entries: requested + reencrypt_start + reencrypt_complete)
    // (audit log verification uses separate audit query)
  });
});
```

### 2. Write test: rotation is idempotent (~20 min)

```typescript
it('rotation API is idempotent — calling twice creates unique key versions', async () => {
  // First rotation: v1→v2
  await POST(mockRequest);
  // Second rotation: v2→v3
  await POST(mockRequest);

  const versions = await db.prepare('SELECT version FROM key_versions').all();
  expect(versions.results.length).toBe(3); // v1, v2, v3
});
```

### 3. Write test: re-encrypt handles empty tables (~15 min)

```typescript
it('re-encrypt handles tables with no matching credentials', async () => {
  // No credentials with old version — should succeed with 0 re-encrypted
  const result = await keyRotationReencrypt.handler({
    event: { data: { keyVersion: 2, oldVersion: 1 } }
  });
  expect(result.total).toBe(0);
  // Old version should still be retired
});
```

### 4. Run integration tests (~10 min)

```bash
npx vitest run src/tree/byok/key-rotation-integration.test.ts
```

## Success Criteria

- [ ] 3 new integration tests in `key-rotation-integration.test.ts`
- [ ] Full pipeline test passes (API → Inngest → re-encrypt → retire → audit)
- [ ] Idempotency test passes
- [ ] Empty table test passes
- [ ] Existing 8/8 unit tests still pass
- [ ] No regression: full test suite passes
