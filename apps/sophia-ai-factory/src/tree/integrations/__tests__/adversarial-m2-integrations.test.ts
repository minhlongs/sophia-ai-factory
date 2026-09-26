/** @vitest-environment node */

/**
 * Empirical Adversarial Test Suite: Milestone M2
 *
 * Scope:
 * 1. CRM sync stage conversion completeness & LWW authority bias on `closed_won`.
 * 2. Cents <-> decimal amount precision property testing.
 * 3. Webhook HMAC-SHA256 signature verification (valid, tampered payload, tampered t, replay expired > 300s).
 * 4. Exponential backoff progression mathematical validation & jitter bounds.
 * 5. HTTP status code retryability classification.
 *
 * @module tree/integrations/__tests__/adversarial-m2-integrations.test
 */

import { describe, it, expect } from 'vitest';
import type { SophiaDealStage, SophiaDealSnapshot } from '../types';
import {
  centsToDecimalAmount,
  decimalAmountToCents,
  transformSophiaToSalesforce,
  transformSalesforceToSophia,
  transformSophiaToHubSpot,
  transformHubSpotToSophia,
  resolveCrmConflict,
  SOPHIA_TO_SALESFORCE_STAGE_MAP,
  SALESFORCE_TO_SOPHIA_STAGE_MAP,
  SOPHIA_TO_HUBSPOT_STAGE_MAP,
  HUBSPOT_TO_SOPHIA_STAGE_MAP,
} from '../crm-sync-engine';
import {
  computeHmacSha256,
  timingSafeEqual,
  signWebhookPayload,
  parseSignatureHeader,
  verifyWebhookSignature,
  calculateNextBackoffDelayMs,
  isRetryableHttpStatus,
  BACKOFF_BASE_DELAYS_MS,
  MAX_DELIVERY_ATTEMPTS,
  DEFAULT_TOLERANCE_SECONDS,
} from '../webhook-dispatcher';

describe('Empirical Adversarial Verification: Milestone M2 (Enterprise CRM & Webhook Bus)', () => {
  // ── 1. CRM Sync Stage Conversion Completeness & Precision ──────────────────

  describe('1. CRM Stage Conversion Completeness & Precision', () => {
    const ALL_SOPHIA_STAGES: SophiaDealStage[] = [
      'new_lead',
      'enriching',
      'qualified',
      'demo_prepared',
      'demo_active',
      'proposal_sent',
      'negotiating',
      'closed_won',
      'closed_lost',
    ];

    it('verifies 100% stage mapping completeness from Sophia to Salesforce and HubSpot', () => {
      expect(ALL_SOPHIA_STAGES).toHaveLength(9);

      for (const stage of ALL_SOPHIA_STAGES) {
        const sfStage = SOPHIA_TO_SALESFORCE_STAGE_MAP[stage];
        const hsStage = SOPHIA_TO_HUBSPOT_STAGE_MAP[stage];

        expect(sfStage, `Missing Salesforce mapping for ${stage}`).toBeDefined();
        expect(typeof sfStage).toBe('string');
        expect(sfStage.length).toBeGreaterThan(0);

        expect(hsStage, `Missing HubSpot mapping for ${stage}`).toBeDefined();
        expect(typeof hsStage).toBe('string');
        expect(hsStage.length).toBeGreaterThan(0);
      }
    });

    it('verifies round-trip stability for terminal stages (closed_won, closed_lost)', () => {
      // Salesforce closed_won
      const sfWon = SOPHIA_TO_SALESFORCE_STAGE_MAP['closed_won'];
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP[sfWon]).toBe('closed_won');

      // Salesforce closed_lost
      const sfLost = SOPHIA_TO_SALESFORCE_STAGE_MAP['closed_lost'];
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP[sfLost]).toBe('closed_lost');

      // HubSpot closed_won
      const hsWon = SOPHIA_TO_HUBSPOT_STAGE_MAP['closed_won'];
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP[hsWon]).toBe('closed_won');

      // HubSpot closed_lost
      const hsLost = SOPHIA_TO_HUBSPOT_STAGE_MAP['closed_lost'];
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP[hsLost]).toBe('closed_lost');
    });

    it('safely handles unknown external CRM stages by falling back to new_lead', () => {
      const sfUnknown = transformSalesforceToSophia({
        Name: 'Mystery Deal',
        StageName: 'NonExistentCustomStage_XYZ' as any,
      });
      expect(sfUnknown.dealStage).toBe('new_lead');

      const hsUnknown = transformHubSpotToSophia({
        dealname: 'Mystery Deal',
        dealstage: 'random_custom_pipeline_step' as any,
      });
      expect(hsUnknown.dealStage).toBe('new_lead');
    });

    it('proves bijective decimal <-> integer cents precision across 10,000 price values', () => {
      for (let c = 1; c <= 10000; c++) {
        const decimal = centsToDecimalAmount(c);
        const backToCents = decimalAmountToCents(decimal);
        expect(backToCents).toBe(c);
      }

      // Edge cases
      expect(centsToDecimalAmount(0)).toBe(0);
      expect(centsToDecimalAmount(-100)).toBe(0);
      expect(decimalAmountToCents(0)).toBe(0);
      expect(decimalAmountToCents(null)).toBe(0);
      expect(decimalAmountToCents(undefined)).toBe(0);
      expect(decimalAmountToCents('1500.50')).toBe(150050);
      expect(decimalAmountToCents('invalid_number')).toBe(0);
    });
  });

  // ── 2. LWW Conflict Resolution & Sophia Authority Bias ──────────────────────

  describe('2. LWW Conflict Resolution & Sophia Authority Bias on closed_won', () => {
    const baseClosedWonDeal: SophiaDealSnapshot = {
      id: 'deal_enterprise_alpha',
      companyName: 'Acme Corp',
      companyDomain: 'acme.com',
      dealStage: 'closed_won',
      dealValueEstimateCents: 500_000, // $5,000.00 USD
      currency: 'USD',
      leadEmail: 'founder@acme.com',
      leadPhone: '+1-555-0199',
      sdrNotes: 'Original enterprise contract notes',
      notes: 'Internal sign-off notes',
      closeDate: '2026-09-25',
      updatedAt: 1000,
    };

    it('enforces Sophia authority bias: rejects external CRM attempt to downgrade closed_won stage when contract is signed', () => {
      const downgradeAttempts: SophiaDealStage[] = ['closed_lost', 'negotiating', 'proposal_sent', 'new_lead'];

      for (const targetStage of downgradeAttempts) {
        const result = resolveCrmConflict(
          baseClosedWonDeal,
          { dealStage: targetStage },
          { hasSignedContract: true, incomingTimestamp: 2000, existingTimestamp: 1000 },
        );

        // Stage must NOT change
        expect(result.resolvedDeal.dealStage).toBe('closed_won');
        expect(result.ignoredFields).toContain('dealStage');
        expect(result.appliedFields).not.toContain('dealStage');
        expect(result.action).toBe('ignore');
        expect(result.reason).toContain('SOPHIA_CLOSED_WON_CONTRACT_AUTHORITY_BIAS');
      }
    });

    it('enforces Sophia authority bias: protects commercial deal value on signed closed_won contracts', () => {
      // External CRM attempts to change value from $5,000 to $1,000 or $10,000
      const resultLower = resolveCrmConflict(
        baseClosedWonDeal,
        { dealValueEstimateCents: 100_000 },
        { hasSignedContract: true, incomingTimestamp: 2000, existingTimestamp: 1000 },
      );

      expect(resultLower.resolvedDeal.dealValueEstimateCents).toBe(500_000);
      expect(resultLower.ignoredFields).toContain('dealValueEstimateCents');
      expect(resultLower.action).toBe('ignore');

      const resultHigher = resolveCrmConflict(
        baseClosedWonDeal,
        { dealValueEstimateCents: 1_000_000 },
        { hasSignedContract: true, incomingTimestamp: 2000, existingTimestamp: 1000 },
      );

      expect(resultHigher.resolvedDeal.dealValueEstimateCents).toBe(500_000);
      expect(resultHigher.ignoredFields).toContain('dealValueEstimateCents');
    });

    it('permits external CRM authority on contact information even for closed_won contracts', () => {
      const result = resolveCrmConflict(
        baseClosedWonDeal,
        {
          dealStage: 'negotiating', // Should be ignored
          leadEmail: 'new_billing_lead@acme.com', // Should be applied
          leadPhone: '+1-555-9999', // Should be applied
          sdrNotes: 'Updated by Salesforce SDR rep', // Should be applied
        },
        { hasSignedContract: true, incomingTimestamp: 2000, existingTimestamp: 1000 },
      );

      expect(result.action).toBe('apply');
      expect(result.reason).toContain('PARTIAL_APPLY_WITH_STAGE_PROTECTION');

      // Stage preserved as closed_won
      expect(result.resolvedDeal.dealStage).toBe('closed_won');
      expect(result.ignoredFields).toContain('dealStage');

      // Contact info updated
      expect(result.resolvedDeal.leadEmail).toBe('new_billing_lead@acme.com');
      expect(result.resolvedDeal.leadPhone).toBe('+1-555-9999');
      expect(result.resolvedDeal.sdrNotes).toBe('Updated by Salesforce SDR rep');
      expect(result.appliedFields).toEqual(
        expect.arrayContaining(['leadEmail', 'leadPhone', 'sdrNotes']),
      );
    });

    it('permits stage update if deal is closed_won but contract is NOT yet signed (hasSignedContract: false)', () => {
      const result = resolveCrmConflict(
        baseClosedWonDeal,
        { dealStage: 'negotiating' },
        { hasSignedContract: false, incomingTimestamp: 2000, existingTimestamp: 1000 },
      );

      expect(result.action).toBe('apply');
      expect(result.resolvedDeal.dealStage).toBe('negotiating');
      expect(result.appliedFields).toContain('dealStage');
    });

    it('strictly applies LWW timestamp semantics for non-protected fields: newer applies, older ignores', () => {
      const leadDeal: SophiaDealSnapshot = {
        ...baseClosedWonDeal,
        dealStage: 'negotiating',
      };

      // Fresher update (2000 > 1000): applied
      const freshResult = resolveCrmConflict(
        leadDeal,
        { dealValueEstimateCents: 750_000 },
        { incomingTimestamp: 2000, existingTimestamp: 1000 },
      );
      expect(freshResult.action).toBe('apply');
      expect(freshResult.resolvedDeal.dealValueEstimateCents).toBe(750_000);
      expect(freshResult.appliedFields).toContain('dealValueEstimateCents');

      // Stale update (500 < 1000): ignored
      const staleResult = resolveCrmConflict(
        leadDeal,
        { dealValueEstimateCents: 750_000 },
        { incomingTimestamp: 500, existingTimestamp: 1000 },
      );
      expect(staleResult.action).toBe('ignore');
      expect(staleResult.reason).toContain('STALE_UPDATE_IGNORED');
      expect(staleResult.resolvedDeal.dealValueEstimateCents).toBe(500_000);
      expect(staleResult.ignoredFields).toContain('dealValueEstimateCents');

      // Identical timestamp (1000 === 1000): ignored
      const tieResult = resolveCrmConflict(
        leadDeal,
        { dealValueEstimateCents: 750_000 },
        { incomingTimestamp: 1000, existingTimestamp: 1000 },
      );
      expect(tieResult.action).toBe('ignore');
      expect(tieResult.reason).toContain('STALE_UPDATE_IGNORED');
    });
  });

  // ── 3. Webhook HMAC-SHA256 Signature Verification ───────────────────────────

  describe('3. Webhook HMAC-SHA256 Signature Verification & Anti-Replay', () => {
    const secretKey = 'whsec_enterprise_top_secret_key_12345';
    const payload = JSON.stringify({
      eventType: 'enterprise.deal.closed_won',
      dealId: 'deal_test_100',
      valueCents: 250000,
      timestamp: 1727330000,
    });

    it('verifies valid HMAC-SHA256 signature generated by Web Crypto API', async () => {
      const nowSec = 1727330000;
      const signed = await signWebhookPayload(secretKey, payload, nowSec);

      expect(signed.signatureHeader).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      expect(signed.timestampSeconds).toBe(nowSec);

      const verification = await verifyWebhookSignature(
        secretKey,
        payload,
        signed.signatureHeader,
        { currentTimestampSeconds: nowSec },
      );

      expect(verification.valid).toBe(true);
      expect(verification.timestampSeconds).toBe(nowSec);
    });

    it('rejects tampered payload content with signature mismatch', async () => {
      const nowSec = 1727330000;
      const signed = await signWebhookPayload(secretKey, payload, nowSec);

      // Tamper 1 character in payload: 250000 -> 950000
      const tamperedPayload = payload.replace('250000', '950000');

      const verification = await verifyWebhookSignature(
        secretKey,
        tamperedPayload,
        signed.signatureHeader,
        { currentTimestampSeconds: nowSec },
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('INVALID_SIGNATURE: Signature mismatch');
    });

    it('rejects tampered timestamp in header', async () => {
      const nowSec = 1727330000;
      const signed = await signWebhookPayload(secretKey, payload, nowSec);

      // Tamper timestamp in header from 1727330000 to 1727330001
      const tamperedHeader = signed.signatureHeader.replace(
        `t=${nowSec}`,
        `t=${nowSec + 1}`,
      );

      const verification = await verifyWebhookSignature(
        secretKey,
        payload,
        tamperedHeader,
        { currentTimestampSeconds: nowSec },
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('INVALID_SIGNATURE: Signature mismatch');
    });

    it('rejects expired timestamp exceeding replay tolerance window (> 300 seconds)', async () => {
      const t = 1727330000;
      const signed = await signWebhookPayload(secretKey, payload, t);

      // Exactly 300 seconds later: should be VALID
      const v300 = await verifyWebhookSignature(
        secretKey,
        payload,
        signed.signatureHeader,
        { currentTimestampSeconds: t + 300, toleranceSeconds: 300 },
      );
      expect(v300.valid).toBe(true);

      // 301 seconds later: should be REJECTED (REPLAY_ATTACK_DETECTED)
      const v301 = await verifyWebhookSignature(
        secretKey,
        payload,
        signed.signatureHeader,
        { currentTimestampSeconds: t + 301, toleranceSeconds: 300 },
      );
      expect(v301.valid).toBe(false);
      expect(v301.reason).toContain('REPLAY_ATTACK_DETECTED');

      // Future timestamp > 300s clock skew: should be REJECTED
      const vFuture = await verifyWebhookSignature(
        secretKey,
        payload,
        signed.signatureHeader,
        { currentTimestampSeconds: t - 301, toleranceSeconds: 300 },
      );
      expect(vFuture.valid).toBe(false);
      expect(vFuture.reason).toContain('REPLAY_ATTACK_DETECTED');
    });

    it('rejects malformed signature headers and missing secret key', async () => {
      const malformedHeaders = [
        '',
        '   ',
        'invalid_header',
        't=1727330000', // missing v1
        'v1=abcd', // missing t
        't=not_a_number,v1=abcd',
        'timestamp=123,sig=abc',
      ];

      for (const hdr of malformedHeaders) {
        const v = await verifyWebhookSignature(secretKey, payload, hdr);
        expect(v.valid).toBe(false);
        expect(v.reason).toBe('MALFORMED_SIGNATURE_HEADER');
      }

      // Missing secret key
      const noSecret = await verifyWebhookSignature('', payload, 't=100,v1=abc');
      expect(noSecret.valid).toBe(false);
      expect(noSecret.reason).toBe('MISSING_SECRET_KEY');
    });

    it('verifies constant-time equality comparator against timing attacks', () => {
      expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
      expect(timingSafeEqual('abcdef', 'abcde')).toBe(false);
      expect(timingSafeEqual('a', 'b')).toBe(false);
    });
  });

  // ── 4. Exponential Backoff Progression Mathematical Validation ──────────────

  describe('4. Exponential Backoff Progression Mathematical Validation', () => {
    it('mathematically verifies deterministic base delays for attempts 1 through 5', () => {
      expect(BACKOFF_BASE_DELAYS_MS).toEqual([0, 30_000, 120_000, 600_000, 3_600_000]);

      // Attempt 1: Immediate delivery (0ms)
      expect(calculateNextBackoffDelayMs(1, { enableJitter: false })).toBe(0);

      // Attempt 2: 30 seconds
      expect(calculateNextBackoffDelayMs(2, { enableJitter: false })).toBe(30_000);

      // Attempt 3: 120 seconds (2 minutes) -> 4x increase from attempt 2
      expect(calculateNextBackoffDelayMs(3, { enableJitter: false })).toBe(120_000);
      expect(120_000 / 30_000).toBe(4);

      // Attempt 4: 600 seconds (10 minutes) -> 5x increase from attempt 3
      expect(calculateNextBackoffDelayMs(4, { enableJitter: false })).toBe(600_000);
      expect(600_000 / 120_000).toBe(5);

      // Attempt 5: 3600 seconds (1 hour) -> 6x increase from attempt 4
      expect(calculateNextBackoffDelayMs(5, { enableJitter: false })).toBe(3_600_000);
      expect(3_600_000 / 600_000).toBe(6);

      // Out of bounds: attempt < 1 or attempt > 5
      expect(calculateNextBackoffDelayMs(0, { enableJitter: false })).toBe(0);
      expect(calculateNextBackoffDelayMs(-1, { enableJitter: false })).toBe(0);
      expect(calculateNextBackoffDelayMs(6, { enableJitter: false })).toBe(0);
      expect(calculateNextBackoffDelayMs(10, { enableJitter: false })).toBe(0);
    });

    it('empirically verifies jitter distribution across 10,000 samples within ±10% bounds', () => {
      const attempts = [2, 3, 4, 5];

      for (const attempt of attempts) {
        const base = BACKOFF_BASE_DELAYS_MS[attempt - 1];
        const minBound = Math.floor(base * 0.9);
        const maxBound = Math.ceil(base * 1.1);

        let sum = 0;
        let sumSq = 0;
        const n = 2500;

        for (let i = 0; i < n; i++) {
          const delay = calculateNextBackoffDelayMs(attempt, {
            enableJitter: true,
            jitterFraction: 0.1,
          });

          // Invariant: strictly bounded by ±10%
          expect(delay).toBeGreaterThanOrEqual(minBound);
          expect(delay).toBeLessThanOrEqual(maxBound);

          sum += delay;
          sumSq += delay * delay;
        }

        // Prove non-zero variance (jitter is mathematically active and not constant)
        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        expect(variance).toBeGreaterThan(0);
        expect(mean).toBeGreaterThan(base * 0.95);
        expect(mean).toBeLessThan(base * 1.05);
      }
    });

    it('correctly classifies retryable vs non-retryable HTTP status codes', () => {
      // Non-retryable 4xx client errors (must abort immediately)
      const nonRetryable4xx = [400, 401, 403, 404, 405, 409, 410, 415, 422];
      for (const code of nonRetryable4xx) {
        expect(isRetryableHttpStatus(code), `HTTP ${code} should NOT be retryable`).toBe(false);
      }

      // Retryable 4xx exceptions
      expect(isRetryableHttpStatus(408), 'HTTP 408 Timeout should be retryable').toBe(true);
      expect(isRetryableHttpStatus(429), 'HTTP 429 Rate Limit should be retryable').toBe(true);

      // Retryable 5xx server errors
      const retryable5xx = [500, 502, 503, 504];
      for (const code of retryable5xx) {
        expect(isRetryableHttpStatus(code), `HTTP ${code} should be retryable`).toBe(true);
      }

      // Successful or redirect statuses (no retry needed)
      const successCodes = [200, 201, 204, 301, 302];
      for (const code of successCodes) {
        expect(isRetryableHttpStatus(code), `HTTP ${code} should NOT be retryable`).toBe(false);
      }
    });
  });
});
