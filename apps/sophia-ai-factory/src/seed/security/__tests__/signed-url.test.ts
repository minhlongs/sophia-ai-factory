/**
 * Unit tests for 24-Hour HMAC-SHA256 Signed Download URLs
 */

import { describe, it, expect } from 'vitest';
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
  buildSignedDownloadUrl,
  timingSafeEqual,
  stringToBase64Url,
  base64UrlToString,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
} from '../signed-url';

describe('signed-url (HMAC-SHA256 24-hour video download tokens)', () => {
  const secret = 'super-secret-production-signing-key-123456789';
  const videoId = 'vid_01h8x9y7z2abc';
  const userId = 'usr_vip_enterprise_999';
  const tenantId = 'tenant_apac_singapore';

  it('creates a valid signed download token with default 24h TTL', async () => {
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      secret,
    });

    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const result = await verifySignedDownloadToken({
      token,
      videoId,
      secret,
    });

    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.payload).toBeDefined();
    expect(result.payload?.videoId).toBe(videoId);
    expect(result.payload?.userId).toBe(userId);
    expect(result.payload?.tenantId).toBe(tenantId);

    // Verify expiration is ~86400 seconds into the future
    const expectedExpiry = (result.payload?.issuedAt ?? 0) + DEFAULT_SIGNED_URL_TTL_SECONDS;
    expect(result.payload?.expiresAt).toBe(expectedExpiry);
  });

  it('supports positional parameters overload', async () => {
    const token = await createSignedDownloadToken(
      videoId,
      userId,
      3600,
      secret,
      tenantId
    );

    const result = await verifySignedDownloadToken(token, videoId, secret);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.payload?.videoId).toBe(videoId);
    expect(result.payload?.userId).toBe(userId);
  });

  it('detects and rejects an expired token', async () => {
    // Negative TTL so it is already expired at creation
    const expiredToken = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      ttlSeconds: -10,
      secret,
    });

    const result = await verifySignedDownloadToken({
      token: expiredToken,
      videoId,
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
    expect(result.payload?.videoId).toBe(videoId);
  });

  it('rejects a token with tampered signature', async () => {
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      secret,
    });

    const [payloadB64, sig] = token.split('.');
    // Tamper with last character of hex signature
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    const tamperedToken = `${payloadB64}.${tamperedSig}`;

    const result = await verifySignedDownloadToken({
      token: tamperedToken,
      videoId,
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(false);
    expect(result.payload).toBeUndefined();
  });

  it('rejects a token with tampered payload content', async () => {
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      secret,
    });

    const [, sig] = token.split('.');
    const maliciousPayload = {
      videoId: 'vid_other_unauthorized_video',
      userId,
      tenantId,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    };
    const tamperedB64 = stringToBase64Url(JSON.stringify(maliciousPayload));
    const tamperedToken = `${tamperedB64}.${sig}`;

    const result = await verifySignedDownloadToken({
      token: tamperedToken,
      videoId: 'vid_other_unauthorized_video',
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(false);
  });

  it('rejects verification if queried for a different videoId (cross-video replay attack)', async () => {
    const token = await createSignedDownloadToken({
      videoId: 'vid_original',
      userId,
      tenantId,
      secret,
    });

    const result = await verifySignedDownloadToken({
      token,
      videoId: 'vid_target_victim',
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(false);
  });

  it('rejects verification with wrong secret', async () => {
    const token = await createSignedDownloadToken({
      videoId,
      userId,
      tenantId,
      secret,
    });

    const result = await verifySignedDownloadToken({
      token,
      videoId,
      secret: 'wrong-secret-key-attacker',
    });

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(false);
  });

  it('handles malformed tokens safely without throwing', async () => {
    const malformed = [
      '',
      'notatoken',
      'foo.bar.baz',
      '.signatureonly',
      'payloadonly.',
      'invalidbase64@@@.signature',
      'bm90anNvbg.signature',
    ];

    for (const badToken of malformed) {
      const result = await verifySignedDownloadToken({
        token: badToken,
        videoId,
        secret,
      });
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(false);
    }
  });

  it('throws when creating token without secret or videoId', async () => {
    await expect(
      createSignedDownloadToken({
        videoId: '',
        userId,
        tenantId,
        secret,
      })
    ).rejects.toThrow('INVALID_VIDEO_ID');

    await expect(
      createSignedDownloadToken({
        videoId,
        userId,
        tenantId,
        secret: '',
      })
    ).rejects.toThrow('INVALID_SECRET');
  });

  it('buildSignedDownloadUrl formats URL properly', () => {
    const url = buildSignedDownloadUrl(
      'https://sophia.agencyos.network',
      'vid_123',
      'token.sig'
    );
    expect(url).toBe(
      'https://sophia.agencyos.network/api/videos/vid_123/download?token=token.sig'
    );
  });

  it('timingSafeEqual correctly compares identical and non-identical strings', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
    // Non-string types
    expect(timingSafeEqual(null as unknown as string, 'abc')).toBe(false);
  });

  it('stringToBase64Url and base64UrlToString roundtrip unicode data cleanly', () => {
    const original = 'Sophia AI Factory • APAC Video Dubbing • 日本語 한국어 Tiếng Việt';
    const encoded = stringToBase64Url(original);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    const decoded = base64UrlToString(encoded);
    expect(decoded).toBe(original);
  });
});
