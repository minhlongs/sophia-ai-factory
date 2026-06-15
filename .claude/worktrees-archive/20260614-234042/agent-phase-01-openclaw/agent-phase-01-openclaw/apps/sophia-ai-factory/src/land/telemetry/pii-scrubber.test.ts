/**
 * Tests for PII scrubber — RED-TEAM #2
 * All 5 regex patterns must be covered.
 */

import { describe, it, expect } from 'vitest';
import { scrubPII, scrubPIIDeep } from './pii-scrubber';

describe('scrubPII', () => {
  it('redacts OpenAI/Anthropic sk- keys', () => {
    const input = 'key is sk-abcdefghijklmnopqrstuvwxyz123456';
    expect(scrubPII(input)).toContain('[REDACTED-SK]');
    expect(scrubPII(input)).not.toContain('sk-abcde');
  });

  it('redacts publishable pk_ keys', () => {
    const input = 'pk_live_abcdefghijklmnopqrstuvwxyz';
    expect(scrubPII(input)).toContain('[REDACTED-PK]');
    expect(scrubPII(input)).not.toContain('pk_live');
  });

  it('redacts JWT tokens (eyJ prefix)', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature';
    expect(scrubPII(token)).toContain('[REDACTED-JWT]');
    expect(scrubPII(token)).not.toContain('eyJhbGci');
  });

  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123def456ghi789jkl';
    const result = scrubPII(input);
    expect(result).toContain('Bearer [REDACTED]');
    expect(result).not.toContain('abc123def456');
  });

  it('redacts email addresses', () => {
    const input = 'User email is cashback.mentoring@gmail.com and test@example.org';
    const result = scrubPII(input);
    expect(result).toContain('[REDACTED-EMAIL]');
    expect(result).not.toContain('@gmail.com');
    expect(result).not.toContain('@example.org');
  });

  it('redacts phone numbers', () => {
    const input = 'Call +84901234567 or 0987654321';
    const result = scrubPII(input);
    expect(result).toContain('[REDACTED-PHONE]');
    expect(result).not.toContain('84901234567');
  });

  it('passes through clean strings unchanged', () => {
    const input = 'Normal log message with no PII';
    expect(scrubPII(input)).toBe(input);
  });

  it('handles multiple PII patterns in one string', () => {
    const input = 'sk-secret123456789012345 and user@test.com';
    const result = scrubPII(input);
    expect(result).toContain('[REDACTED-SK]');
    expect(result).toContain('[REDACTED-EMAIL]');
  });
});

describe('scrubPIIDeep', () => {
  it('recursively scrubs nested objects', () => {
    const obj = {
      user: { email: 'test@example.com', name: 'Alice' },
      token: 'sk-abcdefghijklmnopqrstuvwxyz',
    };
    const result = scrubPIIDeep(obj) as Record<string, unknown>;
    const user = result.user as Record<string, unknown>;
    expect(user.email).toContain('[REDACTED-EMAIL]');
    expect((result.token as string)).toContain('[REDACTED-SK]');
    expect(user.name).toBe('Alice'); // non-PII unchanged
  });

  it('scrubs PII in arrays', () => {
    const arr = ['test@example.com', 'normal string'];
    const result = scrubPIIDeep(arr) as string[];
    expect(result[0]).toContain('[REDACTED-EMAIL]');
    expect(result[1]).toBe('normal string');
  });

  it('passes through null/undefined', () => {
    expect(scrubPIIDeep(null)).toBeNull();
    expect(scrubPIIDeep(undefined)).toBeUndefined();
  });

  it('passes through numbers unchanged', () => {
    expect(scrubPIIDeep(42)).toBe(42);
  });
});
