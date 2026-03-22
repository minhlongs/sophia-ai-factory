/**
 * HeyGen Client Tests
 *
 * Tests pure functions and utilities that don't require API calls.
 * Note: createVideoTask and getVideoStatus require full E2E testing.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateDuration,
  verifyWebhookSignature,
} from '@/lib/video/heygen-client';

describe('HeyGen Client - Pure Functions', () => {
  describe('estimateDuration', () => {
    it('should calculate duration for short script (30 words)', () => {
      const script = 'This is a short script with exactly thirty words in total. It should take about twelve seconds to read at normal speaking pace.';
      const duration = estimateDuration(script);
      expect(duration).toBeLessThanOrEqual(15);
      expect(duration).toBeGreaterThan(0);
    });

    it('should calculate duration for medium script (100 words)', () => {
      const script = Array(100).fill('word').join(' ');
      const duration = estimateDuration(script);
      expect(duration).toBeLessThanOrEqual(60);
      expect(duration).toBeGreaterThan(30);
    });

    it('should calculate duration for long script (500 words)', () => {
      const script = Array(500).fill('word').join(' ');
      const duration = estimateDuration(script);
      expect(duration).toBeLessThanOrEqual(240);
      expect(duration).toBeGreaterThan(150);
    });

    it('should handle empty script', () => {
      const duration = estimateDuration('');
      expect(duration).toBeLessThanOrEqual(1);
    });

    it('should handle script with extra whitespace', () => {
      const script = '   This   has   extra   spaces   ';
      const duration = estimateDuration(script);
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('verifyWebhookSignature', () => {
    const secret = 'webhook_secret_123';
    const payload = JSON.stringify({ event: 'task.completed', video_id: '123' });

    it('should verify valid signature', () => {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const signature = `sha256=${expectedSignature}`;
      const isValid = verifyWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signature = 'sha256=invalid_signature';
      const isValid = verifyWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject empty signature', () => {
      const isValid = verifyWebhookSignature(payload, '', secret);

      expect(isValid).toBe(false);
    });

    it('should reject with wrong secret', () => {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(payload)
        .digest('hex');

      const signature = `sha256=${expectedSignature}`;
      const isValid = verifyWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(false);
    });

    it('should handle empty payload', () => {
      const crypto = require('crypto');
      const emptyPayload = '';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(emptyPayload)
        .digest('hex');

      const signature = `sha256=${expectedSignature}`;
      const isValid = verifyWebhookSignature(emptyPayload, signature, secret);

      expect(isValid).toBe(true);
    });
  });
});
