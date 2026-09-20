/**
 * Phase 20 Challenger 1: Adversarial Security & Probes Empirical Test Suite
 *
 * Stress-tests and challenges the Phase 20 backend engines and verification probes:
 * 1. Certificate Tampering: Canonical SHA-256 payload hashing, single-char mutation detection, tamper evidence.
 * 2. Env Sanitizer Stress Test: Pathological environment variables, zero raw secret leakage oracle, mandatory keys.
 * 3. DR Drill Failure Modes: D1 errors, missing/empty R2 bindings, clean failure diagnostics without uncaught exceptions.
 * 4. 11-Checkpoint Probe Robustness: Individual probe timeouts/failures, orchestrator resilience, non-blocking execution.
 *
 * Layer: test (adversarial empirical challenge)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificatePayload,
} from '@/seed/handover/handover-types';
import {
  generateCertificateSha256,
  verifyCertificateSha256,
  canonicalizeCertificatePayload,
  hashStringSha256,
} from '@/seed/handover/certificate-hasher';
import {
  buildCertificatePayload,
  computeHandoverCertificateHash,
  generateCertificateMarkdown,
  generateCertificateHtml,
  CANONICAL_ACCEPTANCE_STATEMENTS,
} from '@/tree/handover/handover-certificate-engine';
import {
  generateSanitizedEnvProduction,
  isSensitiveKey,
  maskSecretValue,
  MANDATORY_PRODUCTION_KEYS,
  PUBLIC_CONFIG_KEYS,
} from '@/tree/handover/env-export-generator';
import {
  executeDrDrillProbe,
  resolveBackupsBucket,
} from '@/tree/handover/dr-drill-executor';
import {
  runAllDay1Probes,
  probeEdgeResponsiveness,
  probeShaParity,
  probeD1CrudConsistency,
  probeR2Bindings,
  probeAuthSessionReadiness,
  probeNowpaymentsReadiness,
  probeTelegramConnectivity,
  probeObservability,
  probeDrDrill,
  probeByokVaultEncryption,
  probeRunbooksCompleteness,
} from '@/tree/handover/day1-verification-engine';
import {
  executeVerificationSuite,
} from '@/forest/handover/verification-orchestrator';

// ==============================================================================
// 1. CERTIFICATE TAMPERING & CRYPTOGRAPHIC ORACLE
// ==============================================================================
describe('Challenger 1 — Target 1: Certificate Tampering & Cryptographic Integrity', () => {
  const validBasePayload: HandoverCertificatePayload = {
    handoverId: 'ho_test_closeout_2026',
    tenantId: 'tenant_agency_01',
    customerName: 'Sovereign Media Group',
    customerEmail: 'ceo@sovereignmedia.vn',
    signerName: 'Nguyen Van A',
    signerEmail: 'ceo@sovereignmedia.vn',
    signerRole: 'Founder & CEO',
    tier: 'MASTER',
    deployedSha: 'a654748390ab',
    timestamp: 1774080000000,
    acceptanceCheckpoints: [
      'Access to all 10 Customer Runbooks received, reviewed, and archived.',
      'Test video generated and verified through creative mission pipeline.',
      'Sensitive API keys and BYOK credentials verified under exclusive customer control.',
      'Support escalation channels, diagnostic export procedures, and disaster recovery validated.',
    ],
    manifestHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  it('generates a deterministic 64-character SHA-256 hex digest for valid certificate payload', async () => {
    const hash = await generateCertificateSha256(validBasePayload);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const verified = await verifyCertificateSha256(validBasePayload, hash);
    expect(verified).toBe(true);
  });

  it('fails verification if single character is modified in signerName', async () => {
    const originalHash = await generateCertificateSha256(validBasePayload);

    // Modify exactly 1 character: 'Nguyen Van A' -> 'Nguyen Van B'
    const tamperedPayload: HandoverCertificatePayload = {
      ...validBasePayload,
      signerName: 'Nguyen Van B',
    };

    const isTamperedValid = await verifyCertificateSha256(tamperedPayload, originalHash);
    expect(isTamperedValid).toBe(false);

    // Single character addition / punctuation
    const tamperedPayload2: HandoverCertificatePayload = {
      ...validBasePayload,
      signerName: 'Nguyen Van A.',
    };
    expect(await verifyCertificateSha256(tamperedPayload2, originalHash)).toBe(false);
  });

  it('fails verification if single character is modified in customerName or customerEmail', async () => {
    const originalHash = await generateCertificateSha256(validBasePayload);

    // Modify customerName by 1 char
    const tamperedName: HandoverCertificatePayload = {
      ...validBasePayload,
      customerName: 'Sovereign Media Grouq', // p -> q
    };
    expect(await verifyCertificateSha256(tamperedName, originalHash)).toBe(false);

    // Modify customerEmail by 1 char
    const tamperedEmail: HandoverCertificatePayload = {
      ...validBasePayload,
      customerEmail: 'ceo@sovereignmedia.com', // .vn -> .com
    };
    expect(await verifyCertificateSha256(tamperedEmail, originalHash)).toBe(false);
  });

  it('fails verification if single character is modified in handoverId, deployedSha, or tier', async () => {
    const originalHash = await generateCertificateSha256(validBasePayload);

    // handoverId 1 char change
    const tamperedHandoverId: HandoverCertificatePayload = {
      ...validBasePayload,
      handoverId: 'ho_test_closeout_2027', // 6 -> 7
    };
    expect(await verifyCertificateSha256(tamperedHandoverId, originalHash)).toBe(false);

    // deployedSha 1 char change
    const tamperedSha: HandoverCertificatePayload = {
      ...validBasePayload,
      deployedSha: 'b654748390ab', // a -> b
    };
    expect(await verifyCertificateSha256(tamperedSha, originalHash)).toBe(false);

    // tier change
    const tamperedTier: HandoverCertificatePayload = {
      ...validBasePayload,
      tier: 'PRO',
    };
    expect(await verifyCertificateSha256(tamperedTier, originalHash)).toBe(false);
  });

  it('fails verification if timestamp is altered by even 1 millisecond', async () => {
    const originalHash = await generateCertificateSha256(validBasePayload);

    const tamperedTimestampPlus1: HandoverCertificatePayload = {
      ...validBasePayload,
      timestamp: validBasePayload.timestamp + 1,
    };
    expect(await verifyCertificateSha256(tamperedTimestampPlus1, originalHash)).toBe(false);

    const tamperedTimestampMinus1: HandoverCertificatePayload = {
      ...validBasePayload,
      timestamp: validBasePayload.timestamp - 1,
    };
    expect(await verifyCertificateSha256(tamperedTimestampMinus1, originalHash)).toBe(false);
  });

  it('fails verification if acceptance statements are tampered, added, or removed', async () => {
    const originalHash = await generateCertificateSha256(validBasePayload);

    // 1 char modified inside a statement
    const tamperedStatement: HandoverCertificatePayload = {
      ...validBasePayload,
      acceptanceCheckpoints: [
        validBasePayload.acceptanceCheckpoints[0] + '.',
        ...validBasePayload.acceptanceCheckpoints.slice(1),
      ],
    };
    expect(await verifyCertificateSha256(tamperedStatement, originalHash)).toBe(false);

    // Statement removed
    const removedStatement: HandoverCertificatePayload = {
      ...validBasePayload,
      acceptanceCheckpoints: validBasePayload.acceptanceCheckpoints.slice(0, 3),
    };
    expect(await verifyCertificateSha256(removedStatement, originalHash)).toBe(false);

    // Statement added
    const addedStatement: HandoverCertificatePayload = {
      ...validBasePayload,
      acceptanceCheckpoints: [
        ...validBasePayload.acceptanceCheckpoints,
        'Extra unauthorized acceptance condition.',
      ],
    };
    expect(await verifyCertificateSha256(addedStatement, originalHash)).toBe(false);
  });

  it('fails verification if hash string is tampered, truncated, or invalid', async () => {
    const validHash = await generateCertificateSha256(validBasePayload);

    // Modify 1 char in hash string
    const firstChar = validHash[0];
    const invertedChar = firstChar === 'a' ? 'b' : 'a';
    const tamperedHash = invertedChar + validHash.slice(1);
    expect(await verifyCertificateSha256(validBasePayload, tamperedHash)).toBe(false);

    // Truncated hash (63 chars)
    expect(await verifyCertificateSha256(validBasePayload, validHash.slice(0, 63))).toBe(false);

    // Empty string
    expect(await verifyCertificateSha256(validBasePayload, '')).toBe(false);

    // Null or undefined cast
    expect(await verifyCertificateSha256(validBasePayload, null as unknown as string)).toBe(false);
    expect(await verifyCertificateSha256(validBasePayload, undefined as unknown as string)).toBe(false);
  });

  it('end-to-end: certificate engine markdown and HTML embed exact tamper-evident SHA-256 digest', async () => {
    const dummyRecord: CustomerHandoverRecord = {
      id: 'ho_rec_999',
      customer_user_id: 'usr_ceo_1',
      agency_name: 'Alpha Creative Lab',
      agency_type: 'b2b_saas',
      tier: 'MASTER',
      starter_sops: JSON.stringify(['sop-01']),
      magic_link_token: null,
      magic_link_expires_at: null,
      created_by_admin_id: 'admin_sys',
      created_at: 1774080000000,
      welcome_email_sent_at: 1774080000000,
      customer_first_login_at: 1774080000000,
      customer_first_sop_install_at: null,
      customer_first_run_at: null,
      status: 'active',
      source: 'manual',
      trigger_payment_id: null,
      tenant_id: 'tenant_alpha',
      signer_name: 'Tran Thi B',
      signer_email: 'b@alphalab.vn',
      signer_role: 'Managing Director',
      certificate_hash: null,
      acceptance_status: 'accepted',
      verification_results: null,
      signed_at: 1774080000000,
      verification_passed_at: 1774080000000,
      certificate_r2_key: null,
      notes: 'Fully approved without objections.',
    };

    const input: HandoverAcceptanceInput = {
      handoverId: 'ho_rec_999',
      signerName: 'Tran Thi B',
      signerEmail: 'b@alphalab.vn',
      signerRole: 'Managing Director',
    };

    const fixedTime = 1774080000000;
    const computedHash = await computeHandoverCertificateHash(
      dummyRecord,
      input,
      'commit_sha_12345',
      fixedTime,
    );

    const certificate = {
      id: 'cert_alpha_01',
      handoverId: dummyRecord.id,
      tenantId: dummyRecord.tenant_id,
      customerName: dummyRecord.agency_name,
      customerEmail: input.signerEmail,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      signerRole: input.signerRole,
      tier: dummyRecord.tier,
      deployedSha: 'commit_sha_12345',
      certificateSha256: computedHash,
      verificationResults: null,
      contentMarkdown: '',
      metadataJson: null,
      createdAt: fixedTime,
    };

    const markdown = generateCertificateMarkdown(certificate);
    expect(markdown).toContain(computedHash);
    expect(markdown).toContain('Tran Thi B');
    expect(markdown).toContain('Alpha Creative Lab');

    const html = generateCertificateHtml(certificate);
    expect(html).toContain(computedHash);
    expect(html).toContain('Tran Thi B');
    expect(html).toContain('Alpha Creative Lab');
  });
});

// ==============================================================================
// 2. ENV SANITIZER PATHOLOGICAL STRESS TEST & ZERO SECRET LEAKAGE ORACLE
// ==============================================================================
describe('Challenger 1 — Target 2: Env Sanitizer Stress Test & Secret Leakage Oracle', () => {
  const sampleEnvExample = `# ==============================================================================
# Sophia AI Factory — Production Environment Specification
# ==============================================================================

# ─── Public Configurations ───
NEXT_PUBLIC_APP_URL=https://sophia.agencyos.network
BETTER_AUTH_URL=https://sophia.agencyos.network
IS_CONFIGURED=true
FEATURE_PAYOS=true
SUPPORT_EMAIL=support@agencyos.network

# ─── Sensitive Core Secrets (Mandatory) ───
BETTER_AUTH_SECRET=
CRON_SECRET=
API_ENCRYPTION_KEY=
BYOK_MASTER_KEY=
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
RESEND_API_KEY=

# ─── Third-Party Provider Keys ───
FAL_KEY=
ELEVENLABS_API_KEY=
OPENROUTER_API_KEY=
RUNPOD_API_KEY=
TELEGRAM_BOT_TOKEN=
UPSTASH_REDIS_REST_TOKEN=
DATABASE_AUTH_TOKEN=
SENTRY_AUTH_TOKEN=
`;

  it('prevents ANY raw secret values from leaking into sanitized content', () => {
    // 15 distinct high-entropy secret strings that must NEVER appear in output
    const secretsCanary: Record<string, string> = {
      BETTER_AUTH_SECRET: 'CANARY_AUTH_SECRET_xK9#m$P2!qW8@zL4%vN1^jR7',
      CRON_SECRET: 'CANARY_CRON_SECRET_987654321_alpha_bravo_charlie',
      API_ENCRYPTION_KEY: 'CANARY_ENCRYPTION_KEY_32_bytes_long_string_here!',
      BYOK_MASTER_KEY: 'CANARY_BYOK_MASTER_KEY_super_secret_envelope_vault',
      NOWPAYMENTS_API_KEY: 'CANARY_NOWPAYMENTS_KEY_np_live_abcdef1234567890',
      NOWPAYMENTS_IPN_SECRET: 'CANARY_NOWPAYMENTS_IPN_SEC_7894561230abcdef',
      RESEND_API_KEY: 'CANARY_RESEND_KEY_re_123456789_abcdefghijklmn',
      FAL_KEY: 'CANARY_FAL_KEY_fal_secret_token_12345',
      ELEVENLABS_API_KEY: 'CANARY_ELEVENLABS_KEY_xi_apikey_999888777',
      OPENROUTER_API_KEY: 'CANARY_OPENROUTER_KEY_sk-or-v1-abcdef0123456789',
      RUNPOD_API_KEY: 'CANARY_RUNPOD_KEY_rpa_live_xyz987654',
      TELEGRAM_BOT_TOKEN: '1234567890:CANARY_TELEGRAM_BOT_TOKEN_ABCDEFGHIJKLMN',
      UPSTASH_REDIS_REST_TOKEN: 'CANARY_REDIS_TOKEN_AxYz9876543210',
      DATABASE_AUTH_TOKEN: 'CANARY_DB_AUTH_TOKEN_super_secret_d1_access',
      SENTRY_AUTH_TOKEN: 'CANARY_SENTRY_AUTH_TOKEN_sntrys_abcdef0123456789',
    };

    const runtimeEnv: Record<string, string> = {
      ...secretsCanary,
      NEXT_PUBLIC_APP_URL: 'https://custom-client-domain.agencyos.network',
      BETTER_AUTH_URL: 'https://custom-client-domain.agencyos.network',
      SUPPORT_EMAIL: 'ops@custom-client.com',
    };

    const result = generateSanitizedEnvProduction(sampleEnvExample, runtimeEnv);

    // Adversarial verification: verify EVERY canary secret is absent from output
    for (const [key, secretValue] of Object.entries(secretsCanary)) {
      expect(result.sanitizedContent).not.toContain(secretValue);
    }

    // Verify redaction indicators are present with correct lengths
    expect(result.sanitizedContent).toContain(`BETTER_AUTH_SECRET=[REDACTED_SECRET:len=${secretsCanary.BETTER_AUTH_SECRET.length}]`);
    expect(result.sanitizedContent).toContain(`NOWPAYMENTS_API_KEY=[REDACTED_API_KEY:len=${secretsCanary.NOWPAYMENTS_API_KEY.length}]`);
    expect(result.sanitizedContent).toContain(`API_ENCRYPTION_KEY=[REDACTED_KEY:len=${secretsCanary.API_ENCRYPTION_KEY.length}]`);

    // Verify public configs ARE preserved
    expect(result.sanitizedContent).toContain('NEXT_PUBLIC_APP_URL=https://custom-client-domain.agencyos.network');
    expect(result.sanitizedContent).toContain('SUPPORT_EMAIL=ops@custom-client.com');
  });

  it('handles pathological secret values: contains "=" signs, raw JSON, quotes, emojis, and very long strings', () => {
    const pathologicalEnv: Record<string, string> = {
      // Secret containing multiple equals signs (like Base64 padding or query strings)
      NOWPAYMENTS_API_KEY: 'base64_encoded==secret==with===multiple=equals=',
      // Secret containing raw JSON string
      BETTER_AUTH_SECRET: '{"key": "auth_val", "equals": "a=b=c", "nested": true}',
      // Extremely long secret (10,000 characters)
      BYOK_MASTER_KEY: 'X'.repeat(10000),
      // Unicode and emojis
      CRON_SECRET: '🔒bảo_mật_tối_cao_2026_tiếng_việt_có_dấu_🇻🇳',
      // Raw quotes and SQL injections
      API_ENCRYPTION_KEY: `"admin' OR '1'='1; DROP TABLE customer_handovers; --"`,
    };

    const result = generateSanitizedEnvProduction(sampleEnvExample, pathologicalEnv);

    // None of the raw pathological values should appear verbatim
    expect(result.sanitizedContent).not.toContain('base64_encoded==secret==with===multiple=equals=');
    expect(result.sanitizedContent).not.toContain('{"key": "auth_val"');
    expect(result.sanitizedContent).not.toContain('X'.repeat(10000));
    expect(result.sanitizedContent).not.toContain('🔒bảo_mật_tối_cao');
    expect(result.sanitizedContent).not.toContain('DROP TABLE');

    // Expected length markers
    expect(result.sanitizedContent).toContain(`NOWPAYMENTS_API_KEY=[REDACTED_API_KEY:len=${pathologicalEnv.NOWPAYMENTS_API_KEY.length}]`);
    expect(result.sanitizedContent).toContain(`BYOK_MASTER_KEY=[REDACTED_KEY:len=10000]`);
    expect(result.sanitizedContent).toContain(`CRON_SECRET=[REDACTED_SECRET:len=${pathologicalEnv.CRON_SECRET.length}]`);
  });

  it('flags missing mandatory production keys accurately when values are empty strings or undefined', () => {
    // Current runtime env provides NO mandatory keys
    const emptyRuntimeEnv: Record<string, string> = {
      NEXT_PUBLIC_APP_URL: 'https://sophia.agencyos.network',
      BETTER_AUTH_URL: 'https://sophia.agencyos.network',
      BETTER_AUTH_SECRET: '', // explicitly empty string
      NOWPAYMENTS_API_KEY: '', // explicitly empty string
    };

    const result = generateSanitizedEnvProduction(sampleEnvExample, emptyRuntimeEnv);

    // BETTER_AUTH_SECRET, CRON_SECRET, API_ENCRYPTION_KEY, BYOK_MASTER_KEY,
    // NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, RESEND_API_KEY must all be flagged
    expect(result.missingKeys).toContain('BETTER_AUTH_SECRET');
    expect(result.missingKeys).toContain('CRON_SECRET');
    expect(result.missingKeys).toContain('API_ENCRYPTION_KEY');
    expect(result.missingKeys).toContain('BYOK_MASTER_KEY');
    expect(result.missingKeys).toContain('NOWPAYMENTS_API_KEY');
    expect(result.missingKeys).toContain('NOWPAYMENTS_IPN_SECRET');
    expect(result.missingKeys).toContain('RESEND_API_KEY');

    // NEXT_PUBLIC_APP_URL is present, so not missing
    expect(result.missingKeys).not.toContain('NEXT_PUBLIC_APP_URL');

    // Warnings must reflect the missing mandatory keys
    expect(result.warnings.length).toBe(result.missingKeys.length);
    for (const missingKey of result.missingKeys) {
      expect(result.warnings.some((w) => w.includes(missingKey))).toBe(true);
    }
  });

  it('classifies sensitive keys correctly regardless of casing or compound naming', () => {
    expect(isSensitiveKey('ANY_SECRET')).toBe(true);
    expect(isSensitiveKey('MY_CUSTOM_API_KEY')).toBe(true);
    expect(isSensitiveKey('ACCESS_TOKEN')).toBe(true);
    expect(isSensitiveKey('DB_PASSWORD')).toBe(true);
    expect(isSensitiveKey('OAUTH_CLIENT_CREDENTIALS')).toBe(true);
    expect(isSensitiveKey('SENTRY_DSN')).toBe(true);
    expect(isSensitiveKey('HASH_SALT')).toBe(true);

    // Explicitly public keys
    expect(isSensitiveKey('NEXT_PUBLIC_APP_URL')).toBe(false);
    expect(isSensitiveKey('BETTER_AUTH_URL')).toBe(false);
    expect(isSensitiveKey('IS_CONFIGURED')).toBe(false);
    expect(isSensitiveKey('RESEND_FROM_EMAIL')).toBe(false);
    expect(isSensitiveKey('SUPPORT_EMAIL')).toBe(false);
  });
});

// ==============================================================================
// 3. DR DRILL FAILURE MODES & ADVERSARIAL STRESS TEST
// ==============================================================================
describe('Challenger 1 — Target 3: DR Drill Failure Modes & Fault Handling', () => {
  it('returns clean failure diagnostics when D1 database is completely null or unavailable', async () => {
    // Spy on getD1 to return null
    const dbModule = await import('@/seed/db/client');
    const spy = vi.spyOn(dbModule, 'getD1').mockResolvedValue(null);

    try {
      const result = await executeDrDrillProbe({}, null as unknown as D1Database);

      expect(result.status).toBe('FAIL');
      expect(result.tablesVerified).toBe(0);
      expect(result.tableList).toEqual([]);
      expect(result.r2BackupObjectFound).toBe(false);
      expect(result.writeProbeSuccessful).toBe(false);
      expect(result.readProbeSuccessful).toBe(false);
      expect(result.checksumMatched).toBe(false);
      expect(result.error).toBe('D1 binding null');
      expect(result.details).toContain('Cloudflare D1 database binding unavailable');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('catches and handles D1 query exceptions without uncaught exceptions or server crash', async () => {
    // Mock D1 that throws on execute
    const failingD1 = {
      prepare: vi.fn().mockImplementation((query: string) => {
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockRejectedValue(new Error('D1_STORAGE_IO_ERROR: disk read failed')),
          first: vi.fn().mockRejectedValue(new Error('D1_QUERY_TIMEOUT: query exceeded 30000ms')),
          run: vi.fn().mockRejectedValue(new Error('D1_LOCK_TIMEOUT')),
        };
      }),
    } as unknown as D1Database;

    const result = await executeDrDrillProbe({}, failingD1);

    expect(result.status).toBe('FAIL');
    expect(result.error).toContain('D1_STORAGE_IO_ERROR');
    expect(result.details).toContain('DR drill execution failed');
    expect(result.writeProbeSuccessful).toBe(false);
    expect(result.readProbeSuccessful).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('completes gracefully when R2 BACKUPS_BUCKET binding is missing or empty', async () => {
    // Mock healthy D1
    const healthyD1 = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('sqlite_master')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [{ name: 'user' }, { name: 'customer_handovers' }],
            }),
          };
        }
        return {
          bind: vi.fn().mockImplementation((nonce: string) => ({
            first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
          })),
        };
      }),
    } as unknown as D1Database;

    // Missing R2 bucket in envOverride
    const resultWithoutR2 = await executeDrDrillProbe({}, healthyD1);

    expect(resultWithoutR2.status).toBe('PASS');
    expect(resultWithoutR2.tablesVerified).toBe(2);
    expect(resultWithoutR2.writeProbeSuccessful).toBe(true);
    expect(resultWithoutR2.readProbeSuccessful).toBe(true);
    expect(resultWithoutR2.r2BackupObjectFound).toBe(false);
    expect(resultWithoutR2.details).toContain('DR Drill verified');
  });

  it('handles R2 bucket throwing errors during listing or put without crashing', async () => {
    const healthyD1 = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('sqlite_master')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [{ name: 'user' }, { name: 'customer_handovers' }],
            }),
          };
        }
        return {
          bind: vi.fn().mockImplementation((nonce: string) => ({
            first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
          })),
        };
      }),
    } as unknown as D1Database;

    // Mock R2 bucket that rejects on list
    const faultyR2 = {
      list: vi.fn().mockRejectedValue(new Error('R2_NETWORK_TIMEOUT: request aborted')),
      put: vi.fn().mockRejectedValue(new Error('R2_QUOTA_EXCEEDED')),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const envWithFaultyR2 = {
      BACKUPS_BUCKET: faultyR2,
    };

    const result = await executeDrDrillProbe(envWithFaultyR2, healthyD1);

    // Should complete cleanly without throwing, with status PASS for D1 while warning logged for R2
    expect(result.status).toBe('PASS');
    expect(result.writeProbeSuccessful).toBe(true);
    expect(result.readProbeSuccessful).toBe(true);
    expect(result.tablesVerified).toBe(2);
  });

  it('returns WARN when core tables (user, customer_handovers) are missing from database', async () => {
    const incompleteD1 = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('sqlite_master')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [{ name: 'unrelated_table_only' }],
            }),
          };
        }
        return {
          bind: vi.fn().mockImplementation((nonce: string) => ({
            first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
          })),
        };
      }),
    } as unknown as D1Database;

    const result = await executeDrDrillProbe({}, incompleteD1);

    expect(result.status).toBe('WARN');
    expect(result.tablesVerified).toBe(1);
    expect(result.details).toContain('DR Drill warnings');
  });
});

// ==============================================================================
// 4. 11-CHECKPOINT PROBE ROBUSTNESS & TIMEOUT RESILIENCE
// ==============================================================================
describe('Challenger 1 — Target 4: 11-Checkpoint Probe Robustness & Orchestrator Resilience', () => {
  it('individual probe: probeEdgeResponsiveness handles network errors gracefully', async () => {
    // Force network call with an unroutable / invalid domain
    const result = await probeEdgeResponsiveness({
      baseUrl: 'http://127.0.0.1:59999', // Closed port
      timeoutMs: 100,
    });

    expect(['PASS', 'WARN']).toContain(result.status);
    expect(result.checkpointId).toBe('edge_responsiveness');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('individual probe: probeByokVaultEncryption validates AES-256-GCM round-trip successfully', async () => {
    const result = await probeByokVaultEncryption();

    expect(result.status).toBe('PASS');
    expect(result.checkpointId).toBe('byok_vault_encryption');
    expect(result.details).toContain('AES-256-GCM');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('individual probe: probeRunbooksCompleteness validates all 10 SOPs are registered', () => {
    const result = probeRunbooksCompleteness();

    expect(result.status).toBe('PASS');
    expect(result.checkpointId).toBe('runbooks_completeness');
    expect(result.details).toContain('10/10 operational SOPs');
  });

  it('orchestrator runs all 11 probes concurrently even if D1 and external networks fail', async () => {
    // Failing D1
    const failingD1 = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1_FATAL_CONN_RESET');
      }),
    } as unknown as D1Database;

    const report = await executeVerificationSuite({
      skipNetworkCalls: true,
      db: failingD1,
    });

    // Must return all 11 checkpoints
    expect(report.totalChecks).toBe(11);
    expect(report.checkpoints.length).toBe(11);

    // Failed count must reflect D1 failures (D1 CRUD + DR Drill)
    expect(report.failedCount).toBeGreaterThanOrEqual(1);

    // Overall verdict must be FAIL because of D1 failure, but orchestrator DID NOT CRASH
    expect(report.overallVerdict).toBe('FAIL');

    // Non-D1 independent probes must still succeed!
    const byokCheck = report.checkpoints.find((c) => c.checkpointId === 'byok_vault_encryption');
    expect(byokCheck?.status).toBe('PASS');

    const runbooksCheck = report.checkpoints.find((c) => c.checkpointId === 'runbooks_completeness');
    expect(runbooksCheck?.status).toBe('PASS');

    const authCheck = report.checkpoints.find((c) => c.checkpointId === 'auth_session_readiness');
    expect(['PASS', 'WARN']).toContain(authCheck?.status);
  });

  it('orchestrator handles database persistence failure during report saving without throwing', async () => {
    const failingDbOnUpdate = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('sqlite_master')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [{ name: 'user' }, { name: 'customer_handovers' }],
            }),
          };
        }
        if (query.includes('SELECT 1')) {
          return {
            bind: vi.fn().mockImplementation((nonce: string) => ({
              first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
            })),
          };
        }
        if (query.includes('UPDATE customer_handovers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('D1_PERSIST_ERROR: Read-only replica')),
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
        };
      }),
    } as unknown as D1Database;

    // Persist = true with handoverId, but DB update will fail
    const report = await executeVerificationSuite({
      skipNetworkCalls: true,
      persist: true,
      handoverId: 'ho_test_resilience',
      db: failingDbOnUpdate,
    });

    // Must successfully return report without uncaught exception
    expect(report.runId).toBeDefined();
    expect(report.totalChecks).toBe(11);
  });

  it('handles completely unexpected rejected promises in runAllDay1Probes via Promise.allSettled', async () => {
    // Test that runAllDay1Probes never throws, even with a simulated rejected probe
    const mockProbeError = new Error('UNCAUGHT_CATASTROPHIC_PROBE_EXCEPTION');
    
    // We run runAllDay1Probes with a failing D1 that throws synchronous error
    const throwingD1 = {
      prepare: () => {
        throw mockProbeError;
      },
    } as unknown as D1Database;

    const results = await runAllDay1Probes({}, { skipNetworkCalls: true }, throwingD1);

    expect(results.length).toBe(11);
    const d1Result = results.find((r) => r.checkpointId === 'd1_crud_consistency');
    expect(d1Result?.status).toBe('FAIL');
    expect(d1Result?.details).toContain('UNCAUGHT_CATASTROPHIC_PROBE_EXCEPTION');
  });

  it('orchestrator sets overallVerdict=PASS when all probes pass, and WARN when only warnings exist', async () => {
    // Healthy D1
    const healthyD1 = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('sqlite_master')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [{ name: 'user' }, { name: 'customer_handovers' }],
            }),
          };
        }
        return {
          bind: vi.fn().mockImplementation((nonce: string) => ({
            first: vi.fn().mockResolvedValue({ alive: 1, nonce }),
          })),
        };
      }),
    } as unknown as D1Database;

    const originalSecret = process.env.BETTER_AUTH_SECRET;
    try {
      // Set 32+ char secret so auth probe passes
      process.env.BETTER_AUTH_SECRET = 'super_secret_auth_token_for_day1_verification_test_32chars';

      const report = await executeVerificationSuite({
        skipNetworkCalls: true,
        db: healthyD1,
      });

      expect(report.failedCount).toBe(0);
      expect(['PASS', 'WARN']).toContain(report.overallVerdict);
    } finally {
      process.env.BETTER_AUTH_SECRET = originalSecret;
    }
  });

  it('fuzzing: 50 consecutive randomized single-bit / single-char mutations all fail verification (0% false acceptance)', async () => {
    const basePayload: HandoverCertificatePayload = {
      handoverId: 'fuzz_ho_001',
      tenantId: 'fuzz_tenant_01',
      customerName: 'Fuzz Media Lab',
      customerEmail: 'fuzz@example.com',
      signerName: 'Fuzz Tester',
      signerEmail: 'fuzz@example.com',
      signerRole: 'QA Lead',
      tier: 'SCALE',
      deployedSha: 'fuzz12345678',
      timestamp: 1774081234567,
      acceptanceCheckpoints: ['Checkpoint Alpha', 'Checkpoint Beta'],
    };

    const validHash = await generateCertificateSha256(basePayload);
    expect(await verifyCertificateSha256(basePayload, validHash)).toBe(true);

    const stringKeys: (keyof HandoverCertificatePayload)[] = [
      'handoverId',
      'customerName',
      'signerName',
      'signerRole',
      'tier',
      'deployedSha',
    ];

    for (let i = 0; i < 50; i++) {
      const keyToMutate = stringKeys[i % stringKeys.length];
      const originalValue = String(basePayload[keyToMutate]);
      
      // Mutate by flipping or appending a character
      const mutatedValue = originalValue + String.fromCharCode(65 + (i % 26));
      const mutatedPayload: HandoverCertificatePayload = {
        ...basePayload,
        [keyToMutate]: mutatedValue,
      };

      const isValid = await verifyCertificateSha256(mutatedPayload, validHash);
      expect(isValid).toBe(false);
    }
  });
});
