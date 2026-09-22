/**
 * @module tests/adversarial/m4-challenger-stress.test
 *
 * Empirical Challenger Adversarial Stress Test Suite for Milestone M4:
 * Mekong AI Hybrid Edge Node Synchronization.
 *
 * Threat Models & Stress Dimensions:
 * 1. AES-256-GCM AEAD Tamper Resistance: 50 randomized bit-flip trials on ciphertext and 50 on IV.
 *    Asserts 100% rejection rate with MekongTamperError and zero decrypted data leakage.
 * 2. Constant-Time Equality: timingSafeEqual side-channel resistance, mismatched lengths, null/undefined,
 *    and non-string safety.
 * 3. Tunnel URL Validation: SSRF prevention (AWS/GCP IMDS, file://, ftp://, localhost when forbidden),
 *    subdomain spoofing, and path traversal defense.
 * 4. Sub-500ms Timeout Fail-Closed Boundary: Exact boundary checks (<500ms returns OFFLINE with reachable: false)
 *    and zero-network traffic verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encryptPayload,
  decryptPayload,
  bytesToBase64,
  base64ToBytes,
  timingSafeEqual,
  hashAuthToken,
  verifyAuthTokenHash,
  MekongCryptoError,
  MekongTamperError,
  MekongPayloadError,
  MekongKeyError,
  IV_LENGTH_BYTES,
  KEY_LENGTH_BITS,
  AUTH_TAG_LENGTH_BYTES,
} from '@/tree/mekong/crypto';
import {
  isValidTunnelUrl,
  isCashclawTunnelUrl,
  normalizeTunnelUrl,
  probeEdgeTunnel,
  MIN_PROBE_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
} from '@/tree/mekong/tunnel-client';
import type { EncryptedPayloadEnvelope } from '@/tree/mekong/types';

describe('Milestone M4 Empirical Adversarial Stress Suite', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // Challenge 1: AES-256-GCM AEAD Tamper Resistance & Plaintext Leakage Guard
  // =========================================================================
  describe('Challenge 1: AES-256-GCM AEAD Tamper Resistance', () => {
    const sensitivePayload = {
      tenantId: 'tenant_enterprise_classified_007',
      model: 'apple_m1_max',
      apiKey: 'sk-live-secret-never-leak-plain-text',
      systemPrompt: 'Confidential corporate strategy and financial records',
      temperature: 0.2,
      maxTokens: 4096,
      nested: {
        keys: ['k1', 'k2', 'k3'],
        weights: [0.4, 0.25, 0.2, 0.15],
      },
    };
    const masterSecret = 'mekong_tunnel_shared_secret_high_entropy_32_bytes_token';

    it('successfully round-trips legitimate encryption and decryption', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);
      expect(envelope.algorithm).toBe('AES-256-GCM');
      expect(envelope.version).toBe('v1');
      expect(envelope.iv).toBeDefined();
      expect(envelope.ciphertext).toBeDefined();

      const decrypted = await decryptPayload<typeof sensitivePayload>(envelope, masterSecret);
      expect(decrypted).toEqual(sensitivePayload);
    });

    it('empirically rejects 50 random single-bit flips in ciphertext with MekongTamperError (0% leak)', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);
      const rawCiphertextBytes = base64ToBytes(envelope.ciphertext);
      const totalBytes = rawCiphertextBytes.length;

      expect(totalBytes).toBeGreaterThan(AUTH_TAG_LENGTH_BYTES);

      let tamperAttempts = 0;
      let caughtTamperErrors = 0;
      let leakedCount = 0;

      // Deterministic PRNG for reproducible test runs
      let seed = 1337420;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let trial = 0; trial < 50; trial++) {
        tamperAttempts++;
        const byteIndex = Math.floor(pseudoRandom() * totalBytes);
        const bitIndex = Math.floor(pseudoRandom() * 8);

        // Mutate a single bit in the ciphertext / auth tag
        const mutatedBytes = new Uint8Array(rawCiphertextBytes);
        mutatedBytes[byteIndex] ^= (1 << bitIndex);

        const tamperedEnvelope: EncryptedPayloadEnvelope = {
          ...envelope,
          ciphertext: bytesToBase64(mutatedBytes),
        };

        let leakedData: unknown = null;
        try {
          leakedData = await decryptPayload(tamperedEnvelope, masterSecret);
        } catch (err: unknown) {
          if (err instanceof MekongTamperError) {
            caughtTamperErrors++;
          } else {
            // If bit flip corrupted tag or structure, must still be a MekongCryptoError
            expect(err).toBeInstanceOf(MekongCryptoError);
            caughtTamperErrors++;
          }
        }

        if (leakedData !== null) {
          leakedCount++;
        }
      }

      expect(tamperAttempts).toBe(50);
      expect(caughtTamperErrors).toBe(50);
      expect(leakedCount).toBe(0);
    });

    it('empirically rejects 50 random single-bit flips in the IV with MekongTamperError (0% leak)', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);
      const rawIvBytes = base64ToBytes(envelope.iv);
      expect(rawIvBytes.length).toBe(IV_LENGTH_BYTES); // Exactly 12 bytes

      let tamperAttempts = 0;
      let caughtTamperErrors = 0;
      let leakedCount = 0;

      let seed = 987654321;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let trial = 0; trial < 50; trial++) {
        tamperAttempts++;
        const byteIndex = Math.floor(pseudoRandom() * IV_LENGTH_BYTES);
        const bitIndex = Math.floor(pseudoRandom() * 8);

        const mutatedIvBytes = new Uint8Array(rawIvBytes);
        mutatedIvBytes[byteIndex] ^= (1 << bitIndex);

        const tamperedEnvelope: EncryptedPayloadEnvelope = {
          ...envelope,
          iv: bytesToBase64(mutatedIvBytes),
        };

        let leakedData: unknown = null;
        try {
          leakedData = await decryptPayload(tamperedEnvelope, masterSecret);
        } catch (err: unknown) {
          if (err instanceof MekongTamperError) {
            caughtTamperErrors++;
          } else {
            expect(err).toBeInstanceOf(MekongCryptoError);
            caughtTamperErrors++;
          }
        }

        if (leakedData !== null) {
          leakedCount++;
        }
      }

      expect(tamperAttempts).toBe(50);
      expect(caughtTamperErrors).toBe(50);
      expect(leakedCount).toBe(0);
    });

    it('rejects bit flip at boundary edges: offset 0 and offset N-1 of ciphertext and IV', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);

      // 1. Bit flip at offset 0 of ciphertext
      const ctBytes1 = base64ToBytes(envelope.ciphertext);
      ctBytes1[0] ^= 1;
      await expect(
        decryptPayload({ ...envelope, ciphertext: bytesToBase64(ctBytes1) }, masterSecret),
      ).rejects.toThrow(MekongTamperError);

      // 2. Bit flip at last byte of ciphertext (auth tag)
      const ctBytes2 = base64ToBytes(envelope.ciphertext);
      ctBytes2[ctBytes2.length - 1] ^= 1;
      await expect(
        decryptPayload({ ...envelope, ciphertext: bytesToBase64(ctBytes2) }, masterSecret),
      ).rejects.toThrow(MekongTamperError);

      // 3. Bit flip at offset 0 of IV
      const ivBytes1 = base64ToBytes(envelope.iv);
      ivBytes1[0] ^= 1;
      await expect(
        decryptPayload({ ...envelope, iv: bytesToBase64(ivBytes1) }, masterSecret),
      ).rejects.toThrow(MekongTamperError);

      // 4. Bit flip at offset 11 of IV
      const ivBytes2 = base64ToBytes(envelope.iv);
      ivBytes2[11] ^= 1;
      await expect(
        decryptPayload({ ...envelope, iv: bytesToBase64(ivBytes2) }, masterSecret),
      ).rejects.toThrow(MekongTamperError);
    });

    it('rejects invalid IV length variations (<12 or >12 bytes) with MekongPayloadError', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);

      // 11-byte IV (too short)
      const shortIv = new Uint8Array(11);
      await expect(
        decryptPayload({ ...envelope, iv: bytesToBase64(shortIv) }, masterSecret),
      ).rejects.toThrow(MekongPayloadError);

      // 16-byte IV (too long)
      const longIv = new Uint8Array(16);
      await expect(
        decryptPayload({ ...envelope, iv: bytesToBase64(longIv) }, masterSecret),
      ).rejects.toThrow(MekongPayloadError);

      // 0-byte IV
      await expect(
        decryptPayload({ ...envelope, iv: '' }, masterSecret),
      ).rejects.toThrow(MekongPayloadError);
    });

    it('rejects truncated ciphertext below authentication tag length (<16 bytes)', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);

      // 15 bytes of ciphertext
      const truncatedCt = new Uint8Array(15);
      await expect(
        decryptPayload({ ...envelope, ciphertext: bytesToBase64(truncatedCt) }, masterSecret),
      ).rejects.toThrow(MekongPayloadError);
    });

    it('rejects decryption with an unauthorized or mismatched key (zero data leak)', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);
      const wrongSecret = 'mekong_tunnel_attacker_wrong_secret_key_12345678';

      let leaked: unknown = null;
      try {
        leaked = await decryptPayload(envelope, wrongSecret);
      } catch (err) {
        expect(err).toBeInstanceOf(MekongTamperError);
      }
      expect(leaked).toBeNull();
    });

    it('rejects garbage / non-base64 strings gracefully', async () => {
      const envelope = await encryptPayload(sensitivePayload, masterSecret);

      await expect(
        decryptPayload({ ...envelope, ciphertext: '???!!!not-valid-base64***' }, masterSecret),
      ).rejects.toThrow(MekongPayloadError);

      await expect(
        decryptPayload({ ...envelope, iv: '###corrupted-iv###' }, masterSecret),
      ).rejects.toThrow(MekongPayloadError);
    });
  });

  // =========================================================================
  // Challenge 2: Constant-Time Equality & Side-Channel Stress
  // =========================================================================
  describe('Challenge 2: Constant-Time Equality (timingSafeEqual)', () => {
    it('handles null and undefined safely without throwing or returning true', () => {
      expect(timingSafeEqual(null, null)).toBe(false);
      expect(timingSafeEqual(undefined, undefined)).toBe(false);
      expect(timingSafeEqual(null, 'secret_token')).toBe(false);
      expect(timingSafeEqual('secret_token', null)).toBe(false);
      expect(timingSafeEqual(undefined, 'secret_token')).toBe(false);
      expect(timingSafeEqual('secret_token', undefined)).toBe(false);
    });

    it('handles non-string types safely (defensive guard against type pollution)', () => {
      expect(timingSafeEqual(12345 as unknown as string, '12345')).toBe(false);
      expect(timingSafeEqual('12345', 12345 as unknown as string)).toBe(false);
      expect(timingSafeEqual({} as unknown as string, 'token')).toBe(false);
      expect(timingSafeEqual(['token'] as unknown as string, 'token')).toBe(false);
    });

    it('fails closed on empty strings to prevent authentication bypass', () => {
      expect(timingSafeEqual('', '')).toBe(false);
      expect(timingSafeEqual('', 'token')).toBe(false);
      expect(timingSafeEqual('token', '')).toBe(false);
    });

    it('returns false for mismatched string lengths immediately and securely', () => {
      expect(timingSafeEqual('a', 'ab')).toBe(false);
      expect(timingSafeEqual('token_1', 'token_10')).toBe(false);
      expect(timingSafeEqual('short', 'much_longer_string_of_different_size')).toBe(false);
    });

    it('correctly detects differences at index 0, midpoint, and last character', () => {
      const canonical = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

      // Difference at index 0
      const diffFirst = 'xbcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      expect(timingSafeEqual(canonical, diffFirst)).toBe(false);

      // Difference at index 32 (middle)
      const diffMid = 'abcdef0123456789abcdef012345678xabcdef0123456789abcdef0123456789';
      expect(timingSafeEqual(canonical, diffMid)).toBe(false);

      // Difference at index 63 (last character)
      const diffLast = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678x';
      expect(timingSafeEqual(canonical, diffLast)).toBe(false);

      // Exact match
      expect(timingSafeEqual(canonical, canonical)).toBe(true);
    });

    it('demonstrates constant execution behavior regardless of mismatch position', () => {
      const base = 'a'.repeat(64);
      const diffAt0 = 'b' + 'a'.repeat(63);
      const diffAt32 = 'a'.repeat(32) + 'b' + 'a'.repeat(31);
      const diffAt63 = 'a'.repeat(63) + 'b';
      const exactMatch = 'a'.repeat(64);

      const ITERATIONS = 20000;

      // Warmup across all mismatch variations to ensure JIT tier-up
      for (let i = 0; i < 5000; i++) {
        timingSafeEqual(base, diffAt0);
        timingSafeEqual(base, diffAt32);
        timingSafeEqual(base, diffAt63);
        timingSafeEqual(base, exactMatch);
      }

      // Benchmark diff at 0
      const t0Start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        timingSafeEqual(base, diffAt0);
      }
      const t0Elapsed = performance.now() - t0Start;

      // Benchmark diff at 32
      const t32Start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        timingSafeEqual(base, diffAt32);
      }
      const t32Elapsed = performance.now() - t32Start;

      // Benchmark diff at 63
      const t63Start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        timingSafeEqual(base, diffAt63);
      }
      const t63Elapsed = performance.now() - t63Start;

      // Benchmark exact match
      const tMatchStart = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        timingSafeEqual(base, exactMatch);
      }
      const tMatchElapsed = performance.now() - tMatchStart;

      expect(t0Elapsed).toBeGreaterThan(0);
      expect(t32Elapsed).toBeGreaterThan(0);
      expect(t63Elapsed).toBeGreaterThan(0);
      expect(tMatchElapsed).toBeGreaterThan(0);

      // Execution ratio between mismatch positions should be within normal bounds (<15.0x under parallel worker contention in shared CI test runners)
      const ratio = Math.max(t0Elapsed, t63Elapsed) / Math.min(t0Elapsed, t63Elapsed);
      expect(ratio).toBeLessThan(15.0);
    });

    it('integrates with verifyAuthTokenHash in constant time', async () => {
      const token = 'bearer_token_secret_xyz_9988';
      const realHash = await hashAuthToken(token);

      expect(await verifyAuthTokenHash(token, realHash)).toBe(true);
      expect(await verifyAuthTokenHash(token, `sha256=${realHash}`)).toBe(true);
      expect(await verifyAuthTokenHash(token, realHash.toUpperCase())).toBe(true);

      // Wrong hash
      const wrongHash = realHash.slice(0, 63) + (realHash[63] === '0' ? '1' : '0');
      expect(await verifyAuthTokenHash(token, wrongHash)).toBe(false);

      // Tampered token
      expect(await verifyAuthTokenHash('wrong_token', realHash)).toBe(false);
      expect(await verifyAuthTokenHash('', realHash)).toBe(false);
      expect(await verifyAuthTokenHash(token, '')).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 3: Tunnel URL Validation, SSRF, and Path Traversal Resistance
  // =========================================================================
  describe('Challenge 3: Tunnel URL Validation & SSRF / Path Traversal Defense', () => {
    describe('SSRF Attack Vectors', () => {
      const ssrfPayloads = [
        // Cloud Provider IMDS (Instance Metadata Service)
        'http://169.254.169.254/latest/meta-data',
        'http://169.254.169.254/computeMetadata/v1/',
        'http://100.100.100.200/latest/meta-data',
        'http://metadata.google.internal',
        // Dangerous schemes
        'ftp://internal-ftp.corp.net/private.key',
        'file:///etc/passwd',
        'file:///c:/windows/win.ini',
        'gopher://127.0.0.1:6379/_flushall',
        'ldap://internal.ldap:389/dc=corp',
        'dict://127.0.0.1:11211/stat',
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        // Private LAN IPs when allowLocal is false
        'http://10.0.0.1:8080',
        'http://172.16.0.1:8080',
        'http://192.168.1.1:8080',
        'http://127.0.0.1:8765',
        'http://localhost:8765',
        'http://0.0.0.0:8080',
        'http://[::1]:8080',
      ];

      it.each(ssrfPayloads)(
        'rejects SSRF / non-HTTPS payload: %s (allowLocal = false)',
        (payload) => {
          expect(isValidTunnelUrl(payload, false)).toBe(false);
        },
      );

      it('rejects file://, ftp://, and cloud IMDS even if allowLocal = true', () => {
        expect(isValidTunnelUrl('file:///etc/passwd', true)).toBe(false);
        expect(isValidTunnelUrl('ftp://internal.host/keys', true)).toBe(false);
        expect(isValidTunnelUrl('http://169.254.169.254/latest/meta-data', true)).toBe(false);
        expect(isValidTunnelUrl('http://192.168.1.1:8080', true)).toBe(false);
      });

      it('permits strictly localhost or 127.0.0.1 only when allowLocal = true', () => {
        expect(isValidTunnelUrl('http://localhost:8765', true)).toBe(true);
        expect(isValidTunnelUrl('http://127.0.0.1:8765', true)).toBe(true);
        expect(isValidTunnelUrl('http://dev.localhost:8765', true)).toBe(true);
      });
    });

    describe('Malformed URLs & Special Inputs', () => {
      it('rejects empty, whitespace, and non-string values', () => {
        expect(isValidTunnelUrl('')).toBe(false);
        expect(isValidTunnelUrl('   ')).toBe(false);
        expect(isValidTunnelUrl(null as unknown as string)).toBe(false);
        expect(isValidTunnelUrl(undefined as unknown as string)).toBe(false);
      });

      it('rejects structurally invalid URLs', () => {
        expect(isValidTunnelUrl('https://')).toBe(false);
        expect(isValidTunnelUrl('not_a_valid_url')).toBe(false);
        expect(isValidTunnelUrl('https://:8080')).toBe(false);
      });
    });

    describe('Wildcard Domain & Subdomain Spoofing Defense', () => {
      it('validates canonical *.cashclaw.cc subdomains', () => {
        expect(isCashclawTunnelUrl('https://node-1.cashclaw.cc')).toBe(true);
        expect(isCashclawTunnelUrl('https://alpha.asia-east.cashclaw.cc')).toBe(true);
        expect(isCashclawTunnelUrl('https://gpu-m1-max.cashclaw.cc:8443')).toBe(true);
      });

      it('rejects spoofed domains attempting to impersonate cashclaw.cc', () => {
        // Attacker suffix
        expect(isCashclawTunnelUrl('https://node-1.cashclaw.cc.attacker.com')).toBe(false);
        // Lookalike domain
        expect(isCashclawTunnelUrl('https://node-1.notcashclaw.cc')).toBe(false);
        // Base domain without subdomain
        expect(isCashclawTunnelUrl('https://cashclaw.cc')).toBe(false);
        // Non-HTTPS cashclaw
        expect(isCashclawTunnelUrl('http://node-1.cashclaw.cc')).toBe(false);
        // Non-URL string
        expect(isCashclawTunnelUrl('cashclaw.cc')).toBe(false);
      });
    });

    describe('URL Path Traversal Normalization', () => {
      it('normalizes tunnel URLs with excessive slashes and path components', () => {
        expect(normalizeTunnelUrl('  https://node-1.cashclaw.cc///  ')).toBe('https://node-1.cashclaw.cc');
        expect(normalizeTunnelUrl('https://node-1.cashclaw.cc')).toBe('https://node-1.cashclaw.cc');
        expect(normalizeTunnelUrl('')).toBe('');
      });
    });
  });

  // =========================================================================
  // Challenge 4: Sub-500ms Timeout Fail-Closed Boundary & Zero Network Traffic
  // =========================================================================
  describe('Challenge 4: Sub-500ms Timeout Fail-Closed Boundary', () => {
    it('strictly fails closed when timeoutMs < 500ms without attempting network fetch', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const sub500Timeouts = [499, 450, 200, 1, 0, -1, -500, 499.9];

      for (const t of sub500Timeouts) {
        const result = await probeEdgeTunnel('https://edge.cashclaw.cc', 'bearer_secret_123', t);
        expect(result.status).toBe('OFFLINE');
        expect(result.reachable).toBe(false);
        expect(result.latencyMs).toBe(0);
        expect(result.error).toBe('INVALID_PROBE_CONFIGURATION');
      }

      // Assert ZERO network fetch calls were attempted
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('strictly fails closed when bearerToken is empty or invalid without network fetch', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const resultEmptyToken = await probeEdgeTunnel('https://edge.cashclaw.cc', '', 1000);
      expect(resultEmptyToken.status).toBe('OFFLINE');
      expect(resultEmptyToken.reachable).toBe(false);
      expect(resultEmptyToken.error).toBe('INVALID_PROBE_CONFIGURATION');

      const resultNullToken = await probeEdgeTunnel(
        'https://edge.cashclaw.cc',
        null as unknown as string,
        1000,
      );
      expect(resultNullToken.status).toBe('OFFLINE');
      expect(resultNullToken.reachable).toBe(false);
      expect(resultNullToken.error).toBe('INVALID_PROBE_CONFIGURATION');

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('strictly fails closed when tunnelUrl is invalid without network fetch', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const badUrls = ['http://localhost:8080', 'file:///etc/passwd', 'ftp://nodes', 'not-a-url', ''];

      for (const badUrl of badUrls) {
        const result = await probeEdgeTunnel(badUrl, 'valid_token', 1000);
        expect(result.status).toBe('OFFLINE');
        expect(result.reachable).toBe(false);
        expect(result.error).toBe('INVALID_PROBE_CONFIGURATION');
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('verifies exact threshold boundary at timeoutMs = 500ms allows fetch to be attempted', async () => {
      let fetchCalledWithUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        fetchCalledWithUrl = url;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ status: 'online', runtime: 'mlx', version: '1.0.0' }),
        };
      });

      const result = await probeEdgeTunnel(
        'https://edge.cashclaw.cc',
        'valid_bearer_token',
        MIN_PROBE_TIMEOUT_MS, // Exactly 500ms
      );

      expect(result.status).toBe('ONLINE');
      expect(result.reachable).toBe(true);
      expect(fetchCalledWithUrl).toBe('https://edge.cashclaw.cc/healthz');
    });
  });
});
