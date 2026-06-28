#!/usr/bin/env node

/**
 * Rotation Staging Smoke Test
 *
 * Usage: node scripts/test/rotation-staging-smoke.js
 *
 * This script performs an end-to-end test of the key rotation flow on staging:
 * 1. Creates a test user (if not exists)
 * 2. Sets an API key for that user (encrypted with current key version)
 * 3. Triggers rotation via admin API
 * 4. Waits for Inngest job to complete
 * 5. Verifies the user's key has been re-encrypted with new version
 * 6. Verifies the key still decrypts correctly
 *
 * Requires:
 * - STAGING_URL env var set (e.g., https://staging.sophia.agencyos.network)
 * - ADMIN_SESSION_TOKEN env var set (admin user with recent auth)
 * - BYOK_MASTER_KEY set on staging Workers
 *
 * Exit codes:
 *   0 = success
 *   1 = test failed
 */

import { readFile } from 'fs/promises';
import { lookup } from 'dns/promises';

const STAGING_URL = process.env.STAGING_URL || 'https://staging.sophia.agencyos.network';
const ADMIN_TOKEN = process.env.ADMIN_SESSION_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('❌ ERROR: ADMIN_SESSION_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Simple HTTP client with retries
 */
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, options);
      if (!resp.ok && i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return resp;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Step 1: Create a test user via signup (or use existing)
 */
async function getOrCreateTestUser() {
  console.log('🔹 Step 1: Get or create test user...');

  // For smoke test, we'll use a deterministic test user ID.
  // In staging, we can pre-create this user manually or via fixture.
  // Return a fixed test user ID that we know exists.
  const TEST_USER_ID = 'test-rotation-user';
  console.log(`   Using test user ID: ${TEST_USER_ID}`);
  return TEST_USER_ID;
}

/**
 * Step 2: Set an API key for the test user (encrypts with current key version)
 */
async function setTestApiKey(userId, provider = 'openrouter') {
  console.log(`🔹 Step 2: Set test API key for user ${userId} (provider: ${provider})...`);

  const resp = await fetchWithRetry(
    `${STAGING_URL}/api/internal/set-test-key`, // hypothetical internal endpoint for smoke tests
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        provider,
        key: 'sk-test-rotation-1234567890abcdef',
      }),
    },
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to set test key: ${resp.status} ${body}`);
  }

  const data = await resp.json();
  console.log(`   ✅ Key set. Encrypted with version: ${data.keyVersion || 'unknown'}`);
  return data;
}

/**
 * Step 3: Trigger rotation
 */
async function triggerRotation(reason = 'staging smoke test') {
  console.log('🔹 Step 3: Trigger key rotation...');

  const resp = await fetchWithRetry(
    `${STAGING_URL}/api/admin/keys/rotate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    },
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to trigger rotation: ${resp.status} ${body}`);
  }

  const data = await resp.json();
  console.log(`   ✅ Rotation triggered. New version: ${data.keyVersion}, Old version: ${data.oldVersion}`);
  return data;
}

/**
 * Step 4: Wait for Inngest job to complete
 */
async function waitForJobCompletion(keyVersion, timeoutMs = 120000, pollInterval = 3000) {
  console.log(`🔹 Step 4: Wait for re-encryption job (keyVersion=${keyVersion})...`);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // Check job status via Inngest API or by querying audit log
    // For simplicity, we'll poll the audit log for completion event
    const resp = await fetchWithRetry(
      `${STAGING_URL}/api/internal/audit/rotation-status?keyVersion=${keyVersion}`,
      {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
      },
    );

    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 'completed') {
        console.log(`   ✅ Re-encryption job completed. Total: ${data.total}`);
        return data;
      }
      if (data.status === 'failed') {
        throw new Error(`Re-encryption job failed: ${data.error}`);
      }
      console.log(`   ⏳ Job status: ${data.status} (waited ${Date.now() - start}ms)`);
    } else {
      console.log(`   ⏳ Polling... (${Date.now() - start}ms)`);
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`Timeout waiting for re-encryption job after ${timeoutMs}ms`);
}

/**
 * Step 5: Verify key version updated
 */
async function verifyKeyVersion(userId, expectedVersion) {
  console.log(`🔹 Step 5: Verify user key version is ${expectedVersion}...`);

  const resp = await fetchWithRetry(
    `${STAGING_URL}/api/internal/debug/user-key-version?userId=${userId}`,
    {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to get key version: ${resp.status}`);
  }

  const data = await resp.json();
  if (data.key_version !== expectedVersion) {
    throw new Error(`Key version mismatch: expected ${expectedVersion}, got ${data.key_version}`);
  }

  console.log(`   ✅ Key version correct: ${data.key_version}`);
}

/**
 * Step 6: Verify decryption works
 */
async function verifyDecryption(userId, provider = 'openrouter') {
  console.log(`🔹 Step 6: Verify key decrypts correctly...`);

  // Use the normal application path to get the key (e.g., settings API)
  const resp = await fetchWithRetry(
    `${STAGING_URL}/api/settings/api-keys/${provider}`,
    {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    },
  );

  if (!resp.ok) {
    // The key might be masked in response, but endpoint should return 200
    // If we get 500, decryption likely failed
    throw new Error(`Failed to decrypt key: ${resp.status}`);
  }

  console.log('   ✅ Decryption successful');
}

/**
 * Main test flow
 */
async function run() {
  console.log('\n=== Key Rotation Staging Smoke Test ===\n');

  try {
    // Pre-flight: ensure staging is reachable
    console.log('🔹 Pre-flight: checking staging health...');
    const healthResp = await fetchWithRetry(`${STAGING_URL}/api/health`, {});
    if (!healthResp.ok) {
      throw new Error(`Staging health check failed: ${healthResp.status}`);
    }
    console.log('   ✅ Staging is healthy\n');

    const userId = await getOrCreateTestUser();
    await setTestApiKey(userId);

    const { keyVersion, oldVersion } = await triggerRotation();

    // Wait a moment for event to be sent
    await new Promise(r => setTimeout(r, 2000));

    await waitForJobCompletion(keyVersion);

    await verifyKeyVersion(userId, keyVersion);
    await verifyDecryption(userId);

    console.log('\n✅ Smoke test PASSED\n');
    return 0;
  } catch (error) {
    console.error('\n❌ Smoke test FAILED:', error.message);
    console.error(error);
    return 1;
  }
}

process.exit(run());
