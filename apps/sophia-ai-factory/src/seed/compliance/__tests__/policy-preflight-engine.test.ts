/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { runPolicyPreflight } from '../policy-preflight-engine';

describe('Policy-as-Code Compliance & Pre-flight Engine', () => {
  it('sanitizes HeyGen moderation triggers (forex, broker, crypto, VN financial terms)', () => {
    const res = runPolicyPreflight({
      text: 'Join this forex broker for guaranteed profit and kiếm tiền nhanh on sàn giao dịch crypto!',
      provider: 'heygen',
      jurisdiction: 'VN',
      vertical: 'crypto',
      maxChars: 5000,
    });
    expect(res.replacedCount).toBeGreaterThanOrEqual(4);
    expect(res.sanitizedText.toLowerCase()).not.toContain('forex');
    expect(res.sanitizedText.toLowerCase()).not.toContain('broker');
    expect(res.sanitizedText.toLowerCase()).not.toContain('guaranteed profit');
    expect(res.sanitizedText.toLowerCase()).not.toContain('kiếm tiền nhanh');
    expect(res.sanitizedText.toLowerCase()).not.toContain('sàn giao dịch');
    expect(res.requiredDisclosure).toContain('#QuảngCáo');
    expect(res.exceedsMaxChars).toBe(false);
  });

  it('enforces UK FCA & SG MAS inducement bans and emits strict crypto warning', () => {
    const uk = runPolicyPreflight({
      text: 'Claim your free crypto sign-up bonus today!',
      jurisdiction: 'UK',
      vertical: 'crypto',
    });
    expect(uk.sanitizedText.toLowerCase()).not.toContain('free crypto');
    expect(uk.sanitizedText.toLowerCase()).not.toContain('sign-up bonus');
    expect(uk.requiredDisclosure).toContain('FCA');
    expect(uk.warnings.some((w) => w.includes('STRICT_CRYPTO_JURISDICTION_UK'))).toBe(true);
  });

  it('flags post-sanitization length overflow when maxChars is exceeded', () => {
    const res = runPolicyPreflight({
      text: 'forex '.repeat(10),
      provider: 'heygen',
      maxChars: 50,
    });
    expect(res.exceedsMaxChars).toBe(true);
    expect(res.warnings.some((w) => w.startsWith('TEXT_EXCEEDS_MAX_CHARS:'))).toBe(true);
  });
});
