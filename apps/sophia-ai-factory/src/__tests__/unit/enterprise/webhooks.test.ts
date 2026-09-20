/**
 * Comprehensive Unit Test Suite for Enterprise Outbound Webhooks Engine (Milestone 4)
 *
 * Covers:
 * 1. Web Crypto Timing-Safe HMAC-SHA256 Signer & Verifier (seed/security/hmac-signer.ts)
 *    - Constant-time XOR comparison (timing attack resistance)
 *    - Signature header parser (tolerance, arbitrary ordering, invalid grammar)
 *    - HMAC-SHA256 signature generator (64-char hex, determinism, entropy sensitivity)
 *    - Verification engine (tamper resistance, replay defense +/- 300s, empty payload handling)
 * 2. Webhook Subscription & URL Validation (tree/webhooks/subscription-repo.ts)
 *    - HTTPS protocol enforcement (INVALID_WEBHOOK_URL)
 *    - Event pattern matching (exact match, wildcard '*', prefix match 'video.*')
 *    - Row parsing and serialization resilience
 * 3. Exponential Backoff & Jitter Calculator (tree/webhooks/backoff-calculator.ts)
 *    - Exact enterprise retry schedule: 30s, 2m, 10m, 1h, 6h
 *    - Jitter bounding: [0.89 * base, 1.15 * base]
 *    - Attempt exhaustion & DLQ transition evaluation
 *
 * Layer: Unit Tests (Pure logic, no database I/O)
 *
 * @module __tests__/unit/enterprise/webhooks.test
 */

import { describe, it, expect } from 'vitest';
import {
  generateWebhookSignature,
  verifyWebhookSignature,
  parseSignatureHeader,
  timingSafeEqual,
  computeHmacSha256Hex,
  DEFAULT_TOLERANCE_SECONDS,
  WEBHOOK_SIGNATURE_HEADER,
} from '@/seed/security/hmac-signer';
import {
  validateWebhookUrl,
  isEventSubscribed,
  parseWebhookEndpointRow,
} from '@/tree/webhooks/subscription-repo';
import {
  calculateBackoffDelay,
  calculateNextAttemptTimestamp,
  isAttemptExhausted,
  evaluateAttemptStatus,
  BACKOFF_SCHEDULE_SECONDS,
  MAX_DELIVERY_ATTEMPTS,
} from '@/tree/webhooks/backoff-calculator';
import type { WebhookEndpointRow } from '@/seed/types/outbound-webhooks';

describe('Enterprise Outbound Webhooks — Comprehensive Unit Tests', () => {
  const testSecret = 'whsec_prod_enterprise_secret_test_9876543210';
  const testPayload = JSON.stringify({ video_id: 'vid_123', status: 'completed', duration: 42 });
  const fixedTimestamp = 1717200000;

  // ============================================================================
  // 1. TIMING-SAFE BITWISE EQUAL & HEADER PARSER
  // ============================================================================
  describe('1. Timing-Safe Comparison & Header Parsing', () => {
    it('timingSafeEqual returns true for identical ASCII strings', () => {
      expect(timingSafeEqual('a1b2c3d4e5', 'a1b2c3d4e5')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
      expect(timingSafeEqual('whsec_alpha_beta', 'whsec_alpha_beta')).toBe(true);
    });

    it('timingSafeEqual returns false for unequal lengths without throwing', () => {
      expect(timingSafeEqual('short', 'longer_string')).toBe(false);
      expect(timingSafeEqual('64_characters_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'short')).toBe(false);
    });

    it('timingSafeEqual returns false for single-bit differences in equal lengths', () => {
      expect(timingSafeEqual('abcdef0123456789', 'abcdef0123456788')).toBe(false);
      expect(timingSafeEqual('0000000000000000', '1000000000000000')).toBe(false);
    });

    it('timingSafeEqual returns false gracefully for non-string inputs', () => {
      expect(timingSafeEqual(null as unknown as string, 'abc')).toBe(false);
      expect(timingSafeEqual('abc', undefined as unknown as string)).toBe(false);
      expect(timingSafeEqual(123 as unknown as string, '123')).toBe(false);
    });

    it('parseSignatureHeader correctly extracts t and v1 components', () => {
      const header = 't=1717200000,v1=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const parsed = parseSignatureHeader(header);
      expect(parsed).not.toBeNull();
      expect(parsed?.timestamp).toBe(1717200000);
      expect(parsed?.v1).toBe('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
    });

    it('parseSignatureHeader tolerates inverted order v1 before t', () => {
      const header = 'v1=sig123456,t=1717200000';
      const parsed = parseSignatureHeader(header);
      expect(parsed).toEqual({ timestamp: 1717200000, v1: 'sig123456' });
    });

    it('parseSignatureHeader tolerates whitespace padding around delimiters', () => {
      const header = '  t  =  1717200000  ,  v1  =  hex_sig_xyz  ';
      const parsed = parseSignatureHeader(header);
      expect(parsed).toEqual({ timestamp: 1717200000, v1: 'hex_sig_xyz' });
    });

    it('parseSignatureHeader returns null for malformed or missing parts', () => {
      expect(parseSignatureHeader('')).toBeNull();
      expect(parseSignatureHeader('invalid-format')).toBeNull();
      expect(parseSignatureHeader('t=1717200000')).toBeNull();
      expect(parseSignatureHeader('v1=abcdef')).toBeNull();
      expect(parseSignatureHeader('t=not_a_number,v1=sig')).toBeNull();
      expect(parseSignatureHeader('t=-50,v1=sig')).toBeNull();
    });
  });

  // ============================================================================
  // 2. HMAC-SHA256 SIGNATURE GENERATOR & VERIFIER
  // ============================================================================
  describe('2. Web Crypto HMAC-SHA256 Signatures', () => {
    it('generates signature matching "t=<timestamp>,v1=<64-char-hex>" format', async () => {
      const sig = await generateWebhookSignature(testSecret, testPayload, fixedTimestamp);
      expect(sig).toMatch(/^t=1717200000,v1=[a-f0-9]{64}$/);
      expect(DEFAULT_TOLERANCE_SECONDS).toBe(300);
      expect(WEBHOOK_SIGNATURE_HEADER).toBe('X-Sophia-Signature');
    });

    it('generates deterministic signatures for identical secret, payload, and timestamp', async () => {
      const sig1 = await generateWebhookSignature(testSecret, testPayload, fixedTimestamp);
      const sig2 = await generateWebhookSignature(testSecret, testPayload, fixedTimestamp);
      expect(sig1).toBe(sig2);
    });

    it('generates distinct signatures when timestamp varies', async () => {
      const sig1 = await generateWebhookSignature(testSecret, testPayload, fixedTimestamp);
      const sig2 = await generateWebhookSignature(testSecret, testPayload, fixedTimestamp + 1);
      expect(sig1).not.toBe(sig2);
    });

    it('generates distinct signatures when secret varies', async () => {
      const sig1 = await generateWebhookSignature('whsec_key_AAA', testPayload, fixedTimestamp);
      const sig2 = await generateWebhookSignature('whsec_key_BBB', testPayload, fixedTimestamp);
      expect(sig1).not.toBe(sig2);
    });

    it('computes 64-character lowercase hexadecimal hash via computeHmacSha256Hex', async () => {
      const hex = await computeHmacSha256Hex(testSecret, 'plain-data');
      expect(hex).toHaveLength(64);
      expect(hex).toMatch(/^[a-f0-9]{64}$/);
    });

    it('throws when secret or payload is invalid', async () => {
      await expect(generateWebhookSignature('', testPayload, fixedTimestamp)).rejects.toThrow(/INVALID_SIGNING_SECRET/);
      await expect(generateWebhookSignature(testSecret, null as unknown as string, fixedTimestamp)).rejects.toThrow(/INVALID_SIGNING_PAYLOAD/);
    });

    it('verifies valid signature within 300-second drift tolerance window', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = await generateWebhookSignature(testSecret, testPayload, nowSec);
      const isValid = await verifyWebhookSignature(testSecret, testPayload, header);
      expect(isValid).toBe(true);
    });

    it('rejects signature when payload is tampered', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = await generateWebhookSignature(testSecret, testPayload, nowSec);
      const tampered = JSON.stringify({ video_id: 'vid_123', status: 'completed', duration: 999999 });
      const isValid = await verifyWebhookSignature(testSecret, tampered, header);
      expect(isValid).toBe(false);
    });

    it('rejects signature when secret is incorrect', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = await generateWebhookSignature(testSecret, testPayload, nowSec);
      const isValid = await verifyWebhookSignature('whsec_wrong_attacker_secret', testPayload, header);
      expect(isValid).toBe(false);
    });

    it('rejects replay attack when timestamp is older than 300s tolerance', async () => {
      const staleSec = Math.floor(Date.now() / 1000) - 305;
      const header = await generateWebhookSignature(testSecret, testPayload, staleSec);
      const isValid = await verifyWebhookSignature(testSecret, testPayload, header);
      expect(isValid).toBe(false);
    });

    it('rejects future clock drift when timestamp is ahead by >300s', async () => {
      const futureSec = Math.floor(Date.now() / 1000) + 310;
      const header = await generateWebhookSignature(testSecret, testPayload, futureSec);
      const isValid = await verifyWebhookSignature(testSecret, testPayload, header);
      expect(isValid).toBe(false);
    });

    it('handles empty string payload cleanly during signing and verification', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = await generateWebhookSignature(testSecret, '', nowSec);
      expect(header).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      const isValid = await verifyWebhookSignature(testSecret, '', header);
      expect(isValid).toBe(true);
    });

    it('rejects malformed signature headers safely without exceptions', async () => {
      expect(await verifyWebhookSignature(testSecret, testPayload, '')).toBe(false);
      expect(await verifyWebhookSignature(testSecret, testPayload, 't=123')).toBe(false);
      expect(await verifyWebhookSignature(testSecret, testPayload, 'v1=abc')).toBe(false);
      expect(await verifyWebhookSignature(testSecret, testPayload, 't=invalid,v1=123')).toBe(false);
    });
  });

  // ============================================================================
  // 3. SUBSCRIPTION URL VALIDATION & EVENT FILTERING
  // ============================================================================
  describe('3. Subscription URL Validation & Event Filtering', () => {
    it('validateWebhookUrl accepts valid HTTPS URLs', () => {
      expect(() => validateWebhookUrl('https://api.example.com/webhooks')).not.toThrow();
      expect(() => validateWebhookUrl('https://sub.domain.co.uk:8443/endpoint?token=123')).not.toThrow();
    });

    it('validateWebhookUrl rejects insecure HTTP URLs with INVALID_WEBHOOK_URL', () => {
      expect(() => validateWebhookUrl('http://insecure.example.com/webhooks')).toThrow(/INVALID_WEBHOOK_URL/);
    });

    it('validateWebhookUrl rejects non-string or malformed URLs', () => {
      expect(() => validateWebhookUrl('')).toThrow(/INVALID_WEBHOOK_URL/);
      expect(() => validateWebhookUrl(null)).toThrow(/INVALID_WEBHOOK_URL/);
      expect(() => validateWebhookUrl('ftp://ftp.example.com')).toThrow(/INVALID_WEBHOOK_URL/);
      expect(() => validateWebhookUrl('not-a-valid-url')).toThrow(/INVALID_WEBHOOK_URL/);
    });

    it('isEventSubscribed supports exact matching', () => {
      const subs = ['video.rendered', 'campaign.completed'];
      expect(isEventSubscribed(subs, 'video.rendered')).toBe(true);
      expect(isEventSubscribed(subs, 'campaign.completed')).toBe(true);
      expect(isEventSubscribed(subs, 'payout.processed')).toBe(false);
    });

    it('isEventSubscribed supports global wildcard "*"', () => {
      const subs = ['*'];
      expect(isEventSubscribed(subs, 'video.rendered')).toBe(true);
      expect(isEventSubscribed(subs, 'any.custom.event')).toBe(true);
    });

    it('isEventSubscribed supports namespace wildcard prefix "video.*"', () => {
      const subs = ['video.*', 'billing.invoice'];
      expect(isEventSubscribed(subs, 'video.rendered')).toBe(true);
      expect(isEventSubscribed(subs, 'video.failed')).toBe(true);
      expect(isEventSubscribed(subs, 'billing.invoice')).toBe(true);
      expect(isEventSubscribed(subs, 'billing.refund')).toBe(false);
      expect(isEventSubscribed(subs, 'campaign.completed')).toBe(false);
    });

    it('isEventSubscribed returns false for empty or non-array subscriptions', () => {
      expect(isEventSubscribed([], 'video.rendered')).toBe(false);
      expect(isEventSubscribed(null as unknown as string[], 'video.rendered')).toBe(false);
    });

    it('parseWebhookEndpointRow parses JSON events and sets default values', () => {
      const row: WebhookEndpointRow = {
        id: 'wep_123456789012',
        org_id: 'org_test',
        url: 'https://api.test.com/hooks',
        secret: 'whsec_secret',
        description: 'Test Webhook',
        events: JSON.stringify(['video.rendered', 'campaign.completed']),
        status: 'active',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      };

      const parsed = parseWebhookEndpointRow(row);
      expect(parsed.id).toBe('wep_123456789012');
      expect(parsed.events).toEqual(['video.rendered', 'campaign.completed']);
      expect(parsed.status).toBe('active');
    });

    it('parseWebhookEndpointRow handles corrupted events JSON gracefully', () => {
      const row: WebhookEndpointRow = {
        id: 'wep_corrupted',
        org_id: 'org_test',
        url: 'https://api.test.com/hooks',
        secret: 'whsec_secret',
        description: '',
        events: 'invalid-json-string',
        status: 'disabled',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      };

      const parsed = parseWebhookEndpointRow(row);
      expect(parsed.events).toEqual([]);
      expect(parsed.status).toBe('disabled');
    });
  });

  // ============================================================================
  // 4. BACKOFF SCHEDULE, JITTER & DLQ TRANSITIONS
  // ============================================================================
  describe('4. Exponential Backoff & Jitter Schedule', () => {
    it('adheres to exact backoff schedule: 30s, 2m, 10m, 1h, 6h', () => {
      expect(BACKOFF_SCHEDULE_SECONDS).toEqual([30, 120, 600, 3600, 21600]);
      expect(calculateBackoffDelay(1, false)).toBe(30 * 1000);
      expect(calculateBackoffDelay(2, false)).toBe(120 * 1000);
      expect(calculateBackoffDelay(3, false)).toBe(600 * 1000);
      expect(calculateBackoffDelay(4, false)).toBe(3600 * 1000);
      expect(calculateBackoffDelay(5, false)).toBe(21600 * 1000);
    });

    it('clamps backoff delay to maximum 6h for attempt > 5', () => {
      expect(calculateBackoffDelay(6, false)).toBe(21600 * 1000);
      expect(calculateBackoffDelay(10, false)).toBe(21600 * 1000);
    });

    it('clamps attempt 0 or negative to attempt 1 (30s)', () => {
      expect(calculateBackoffDelay(0, false)).toBe(30 * 1000);
      expect(calculateBackoffDelay(-5, false)).toBe(30 * 1000);
    });

    it('applies jitter within [0.89 * base, 1.15 * base] bounds', () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const baseMs = calculateBackoffDelay(attempt, false);
        for (let i = 0; i < 20; i++) {
          const jittered = calculateBackoffDelay(attempt, true);
          expect(jittered).toBeGreaterThanOrEqual(baseMs * 0.89);
          expect(jittered).toBeLessThanOrEqual(baseMs * 1.15);
        }
      }
    });

    it('supports custom deterministic random function for jitter testing', () => {
      const baseMs = 30 * 1000;
      // randomFn returning 0 -> factor 0.90
      const minJitter = calculateBackoffDelay(1, true, () => 0);
      expect(minJitter).toBe(Math.floor(baseMs * 0.90));

      // randomFn returning 1 -> factor 1.10
      const maxJitter = calculateBackoffDelay(1, true, () => 1);
      expect(maxJitter).toBe(Math.floor(baseMs * 1.10));
    });

    it('calculateNextAttemptTimestamp adds delay to current time', () => {
      const now = 1700000000000;
      const nextAt = calculateNextAttemptTimestamp(1, now, false);
      expect(nextAt).toBe(now + 30000);
    });

    it('isAttemptExhausted returns false for attempts 1..4 and true for 5+', () => {
      expect(MAX_DELIVERY_ATTEMPTS).toBe(5);
      expect(isAttemptExhausted(1)).toBe(false);
      expect(isAttemptExhausted(2)).toBe(false);
      expect(isAttemptExhausted(3)).toBe(false);
      expect(isAttemptExhausted(4)).toBe(false);
      expect(isAttemptExhausted(5)).toBe(true);
      expect(isAttemptExhausted(6)).toBe(true);
    });

    it('evaluateAttemptStatus transitions to success, failed, or dead_letter', () => {
      // Success is always terminal
      expect(evaluateAttemptStatus(1, true)).toEqual({ status: 'success', isTerminal: true });
      expect(evaluateAttemptStatus(4, true)).toEqual({ status: 'success', isTerminal: true });

      // Failure before attempt 5 is retryable
      expect(evaluateAttemptStatus(1, false)).toEqual({ status: 'failed', isTerminal: false });
      expect(evaluateAttemptStatus(4, false)).toEqual({ status: 'failed', isTerminal: false });

      // Failure on or after attempt 5 transitions to dead_letter (terminal)
      expect(evaluateAttemptStatus(5, false)).toEqual({ status: 'dead_letter', isTerminal: true });
      expect(evaluateAttemptStatus(6, false)).toEqual({ status: 'dead_letter', isTerminal: true });
    });
  });
});
