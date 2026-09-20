/**
 * Adversarial Cryptographic Stress & Timing Attack Test Suite (Milestone 4)
 *
 * Empirical Challenger Verification Suite:
 * 1. Timing-Attack Stress Test:
 *    - 10,000 runs against randomized invalid signatures
 *    - Evaluation across prefix match depths (0, 8, 16, 32, 48, 60, 63 matching characters)
 *    - Statistical latency measurement (mean, variance, standard deviation, Pearson correlation)
 *    - Direct constant-time verification of `timingSafeEqual` and `verifyWebhookSignature`
 * 2. Payload Tampering & Fuzzing (130+ distinct mutations):
 *    - JSON structural tampering, scalar alteration, array modifications
 *    - Whitespace perturbations (trailing/leading spaces, tabs, CR/LF, compact vs pretty)
 *    - Unicode & UTF-8 attacks (Vietnamese diacritics, Asian CJK, RTL Arabic/Hebrew, Zero-Width chars, NFC/NFD)
 *    - Surrogate pairs & emoji tampering (unpaired surrogates, emoji swaps, null bytes)
 *    - Single-bit flips at 50 distinct byte positions
 *    - Security payloads (SQLi, XSS, prototype pollution, command injection)
 *    - Boundary truncations and timestamp mismatches
 *    - 100% rejection requirement (zero false positives)
 * 3. Replay Attack & Clock Drift Tolerance Window (±300s):
 *    - Valid within window: now, now - 299s, now + 299s, now - 300s, now + 300s
 *    - Rejected outside window: now - 301s, now + 301s, now - 3600s, now + 86400s
 *    - Tolerance boundaries: tolerance = 0, tolerance = -1
 *    - Malformed timestamps: NaN, Infinity, -Infinity, negative, non-numeric strings
 * 4. Key & Header Fuzzing:
 *    - Empty secrets, null-byte secrets, 1KB secrets, 16KB secrets, unicode/emoji secrets
 *    - Malformed headers: extra commas, missing v1=, missing t=, duplicate t=, duplicate v1=
 *    - Large 1,000-comma DoS resistance and oversized signature stability
 *
 * Layer: Integration Tests / Empirical Challenger
 *
 * @module __tests__/integration/enterprise/webhooks-crypto-stress.test
 */

import { describe, it, expect } from 'vitest';
import {
  generateWebhookSignature,
  verifyWebhookSignature,
  parseSignatureHeader,
  timingSafeEqual,
  computeHmacSha256Hex,
  DEFAULT_TOLERANCE_SECONDS,
} from '@/seed/security/hmac-signer';

describe('Empirical Challenger: Milestone 4 Cryptography, Timing Attacks & Clock Drift Stress', () => {
  const masterSecret = 'whsec_enterprise_adversarial_crypto_challenge_2026_x99';
  const baselineObject = {
    event: 'video.rendered',
    id: 'evt_stress_adversarial_999888',
    org_id: 'org_enterprise_challenger_m4',
    timestamp: 1717200000,
    data: {
      video_id: 'vid_ai_render_4k_001',
      duration_seconds: 180,
      render_quality: '4k_uhd',
      tokens_consumed: 1500,
      tags: ['social', 'marketing', 'vietnam_campaign'],
      author: {
        id: 'usr_creator_01',
        name: 'Nguyễn Văn A',
        email: 'creator@example.com',
      },
    },
  };
  const baselinePayload = JSON.stringify(baselineObject);

  // ============================================================================
  // 1. TIMING-ATTACK RESISTANCE & CONSTANT-TIME STRESS TEST (10,000 RUNS)
  // ============================================================================
  describe('1. Timing-Attack Stress Testing (10,000 Runs)', () => {
    it(
      'executes 10,000 verifyWebhookSignature runs against invalid signatures with zero timing leakage and 100% rejection',
      async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const validHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec);
        const realSig = validHeader.split(',v1=')[1];
        expect(realSig).toHaveLength(64);

        // Warmup V8 JIT compiler
        for (let i = 0; i < 1500; i++) {
          await verifyWebhookSignature(masterSecret, baselinePayload, `t=${nowSec},v1=${'a'.repeat(64)}`);
        }

        const prefixDepths = [0, 8, 16, 32, 48, 60, 63];
        const latenciesByPrefix: Record<number, number[]> = {};
        for (const p of prefixDepths) {
          latenciesByPrefix[p] = [];
        }

        const allDepths: number[] = [];
        const allLatencies: number[] = [];

        let totalRejected = 0;
        const totalRuns = 10000;
        const startTime = performance.now();

        for (let i = 0; i < totalRuns; i++) {
          const depth = prefixDepths[i % prefixDepths.length];
          let candidateSig: string;

          // Introduce length variations for 5% of runs
          if (i % 20 === 0) {
            candidateSig = realSig.slice(0, 32);
          } else {
            // Construct signature matching realSig up to `depth` characters, differing on remainder
            const prefix = realSig.slice(0, depth);
            const flipChar = realSig[depth] === 'a' ? 'b' : 'a';
            const suffix = flipChar.repeat(64 - depth);
            candidateSig = prefix + suffix;
          }

          const attackHeader = `t=${nowSec},v1=${candidateSig}`;
          const t0 = performance.now();
          const isValid = await verifyWebhookSignature(masterSecret, baselinePayload, attackHeader);
          const t1 = performance.now();

          if (!isValid) {
            totalRejected++;
          }

          if (candidateSig.length === 64) {
            const dt = t1 - t0;
            latenciesByPrefix[depth].push(dt);
            allDepths.push(depth);
            allLatencies.push(dt);
          }
        }

        const endTime = performance.now();
        const totalDurationMs = endTime - startTime;

        // Assertion 1: All 10,000 invalid signatures MUST be rejected
        expect(totalRejected).toBe(totalRuns);

        // Assertion 2: Statistical timing analysis across prefix match depths
        const summaryStats: Record<number, { count: number; meanMs: number; stdDevMs: number; variance: number }> = {};
        const prefixMeans: number[] = [];

        for (const depth of prefixDepths) {
          const latencies = latenciesByPrefix[depth];
          const count = latencies.length;
          const mean = latencies.reduce((sum, v) => sum + v, 0) / count;
          const variance = latencies.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
          const stdDev = Math.sqrt(variance);

          summaryStats[depth] = {
            count,
            meanMs: mean,
            stdDevMs: stdDev,
            variance,
          };
          prefixMeans.push(mean);
        }

        // Check Pearson correlation coefficient (r) between prefix match depth and latency across all individual runs (N ~ 9,500)
        const nRuns = allDepths.length;
        const xBar = allDepths.reduce((a, b) => a + b, 0) / nRuns;
        const yBar = allLatencies.reduce((a, b) => a + b, 0) / nRuns;

        let num = 0;
        let denX = 0;
        let denY = 0;
        for (let i = 0; i < nRuns; i++) {
          const dx = allDepths[i] - xBar;
          const dy = allLatencies[i] - yBar;
          num += dx * dy;
          denX += dx * dx;
          denY += dy * dy;
        }
        const pearsonR = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;

        // Spread between maximum mean and minimum mean across all prefix depths
        const maxMean = Math.max(...prefixMeans);
        const minMean = Math.min(...prefixMeans);
        const spreadMeansMs = maxMean - minMean;

        // Difference between 0-character match and 63-character match
        const diffMean0vs63Ms = Math.abs(summaryStats[63].meanMs - summaryStats[0].meanMs);

        // Verifications:
        // 1. Total execution time for 10,000 runs is under 15 seconds
        expect(totalDurationMs).toBeLessThan(15000);
        // 2. Latency difference between 0-match and 63-match is within normal V8 jitter (< 0.10ms)
        expect(diffMean0vs63Ms).toBeLessThan(0.10);
        // 3. Spread across all prefix means is within 0.10ms
        expect(spreadMeansMs).toBeLessThan(0.10);
        // 4. Pearson correlation across all 9,500+ runs must show zero linear timing leakage (|r| < 0.10)
        expect(Math.abs(pearsonR)).toBeLessThan(0.10);
      },
      30000
    );

    it('verifies timingSafeEqual directly across 10,000 iterations for constant-time bitwise comparison', () => {
      const targetString = '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'; // 64 chars
      const prefixes = [0, 4, 8, 16, 24, 32, 40, 48, 56, 60, 63];

      // Warmup
      for (let i = 0; i < 2000; i++) {
        timingSafeEqual(targetString, '0'.repeat(64));
      }

      const meanTimes: number[] = [];

      for (const p of prefixes) {
        const candidate = targetString.slice(0, p) + 'z'.repeat(64 - p);
        const iterations = 1000;
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const t0 = performance.now();
          const isEqual = timingSafeEqual(targetString, candidate);
          const t1 = performance.now();
          expect(isEqual).toBe(false);
          times.push(t1 - t0);
        }

        const avg = times.reduce((a, b) => a + b, 0) / iterations;
        meanTimes.push(avg);
      }

      // Verify that mean times do not diverge substantially between 0 matching chars and 63 matching chars
      const maxMean = Math.max(...meanTimes);
      const minMean = Math.min(...meanTimes);
      expect(maxMean - minMean).toBeLessThan(0.05); // within 50 microseconds
    });
  });

  // ============================================================================
  // 2. PAYLOAD TAMPERING & FUZZING (130+ DISTINCT MUTATIONS)
  // ============================================================================
  describe('2. Payload Tampering & Fuzzing Detection (130+ Mutations)', () => {
    it('rejects 130+ fuzzed mutations of JSON payloads, unicode, surrogates, whitespace, and injections', async () => {
      const fixedTimestamp = Math.floor(Date.now() / 1000);
      const legitimateHeader = await generateWebhookSignature(masterSecret, baselinePayload, fixedTimestamp);

      // Verify legitimate signature passes
      const baselineValid = await verifyWebhookSignature(masterSecret, baselinePayload, legitimateHeader);
      expect(baselineValid).toBe(true);

      const mutations: Array<{ name: string; mutated: string }> = [];

      // Category A: Whitespace Alterations (15 mutations)
      mutations.push(
        { name: 'Trailing space', mutated: baselinePayload + ' ' },
        { name: 'Trailing tab', mutated: baselinePayload + '\t' },
        { name: 'Trailing newline', mutated: baselinePayload + '\n' },
        { name: 'Trailing carriage return + newline', mutated: baselinePayload + '\r\n' },
        { name: 'Leading space', mutated: ' ' + baselinePayload },
        { name: 'Leading tab', mutated: '\t' + baselinePayload },
        { name: 'Leading newline', mutated: '\n' + baselinePayload },
        { name: 'Form feed appended', mutated: baselinePayload + '\f' },
        { name: 'Vertical tab appended', mutated: baselinePayload + '\v' },
        { name: 'Double trailing spaces', mutated: baselinePayload + '  ' },
        { name: 'Pretty printed 2 spaces', mutated: JSON.stringify(baselineObject, null, 2) },
        { name: 'Pretty printed 4 spaces', mutated: JSON.stringify(baselineObject, null, 4) },
        { name: 'Pretty printed tabs', mutated: JSON.stringify(baselineObject, null, '\t') },
        { name: 'Space after colons', mutated: baselinePayload.replace(/:/g, ': ') },
        { name: 'Space after commas', mutated: baselinePayload.replace(/,/g, ', ') }
      );

      // Category B: JSON Semantic & Structural Alterations (20 mutations)
      mutations.push(
        { name: 'Altered event name', mutated: JSON.stringify({ ...baselineObject, event: 'video.failed' }) },
        { name: 'Injected admin flag', mutated: JSON.stringify({ ...baselineObject, is_admin: true }) },
        { name: 'Injected credit balance', mutated: JSON.stringify({ ...baselineObject, balance: 999999 }) },
        { name: 'Altered duration by 1s', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, duration_seconds: 181 } }) },
        { name: 'Altered token count by 1', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, tokens_consumed: 1501 } }) },
        { name: 'Altered quality string', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, render_quality: '1080p' } }) },
        { name: 'Altered author name', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, author: { ...baselineObject.data.author, name: 'Nguyễn Văn B' } } }) },
        { name: 'Altered author email', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, author: { ...baselineObject.data.author, email: 'attacker@example.com' } } }) },
        { name: 'Added tag to array', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, tags: [...baselineObject.data.tags, 'tampered'] } }) },
        { name: 'Removed tag from array', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, tags: baselineObject.data.tags.slice(0, 2) } }) },
        { name: 'Reordered array tags', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, tags: ['vietnam_campaign', 'marketing', 'social'] } }) },
        { name: 'Inverted top-level keys', mutated: JSON.stringify({ data: baselineObject.data, org_id: baselineObject.org_id, id: baselineObject.id, event: baselineObject.event, timestamp: baselineObject.timestamp }) },
        { name: 'Type inversion: duration as string', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, duration_seconds: '180' } }) },
        { name: 'Type inversion: tokens as boolean', mutated: JSON.stringify({ ...baselineObject, data: { ...baselineObject.data, tokens_consumed: true } }) },
        { name: 'Nullified data field', mutated: JSON.stringify({ ...baselineObject, data: null }) },
        { name: 'Empty data object', mutated: JSON.stringify({ ...baselineObject, data: {} }) },
        { name: 'Omitted timestamp field', mutated: JSON.stringify({ event: baselineObject.event, id: baselineObject.id, org_id: baselineObject.org_id, data: baselineObject.data }) },
        { name: 'Float formatting change', mutated: baselinePayload.replace(':180', ':180.0') },
        { name: 'Scientific notation conversion', mutated: baselinePayload.replace('1500', '1.5e3') },
        { name: 'Appended duplicate root key', mutated: baselinePayload.slice(0, -1) + ',"id":"spoofed"}' }
      );

      // Category C: Unicode, Diacritics & Character Encoding (25 mutations)
      mutations.push(
        { name: 'Vietnamese tone alteration', mutated: baselinePayload.replace('Nguyễn Văn A', 'Nguyên Văn A') },
        { name: 'Vietnamese vowel modification', mutated: baselinePayload.replace('Nguyễn', 'Nguyễn ') },
        { name: 'Vietnamese diacritic removal', mutated: baselinePayload.replace('Nguyễn Văn A', 'Nguyen Van A') },
        { name: 'Zero-width space in event', mutated: baselinePayload.replace('video.rendered', 'video.\u200Brendered') },
        { name: 'Zero-width non-joiner', mutated: baselinePayload.replace('video.rendered', 'video.\u200Crendered') },
        { name: 'Zero-width joiner', mutated: baselinePayload.replace('video.rendered', 'video.\u200Drendered') },
        { name: 'Word joiner character', mutated: baselinePayload.replace('video.rendered', 'video.\u2060rendered') },
        { name: 'BOM byte order mark prefix', mutated: '\uFEFF' + baselinePayload },
        { name: 'BOM byte order mark suffix', mutated: baselinePayload + '\uFEFF' },
        { name: 'CJK character injection', mutated: baselinePayload.replace('usr_creator_01', 'usr_creator_01_张伟') },
        { name: 'Japanese Kanji injection', mutated: baselinePayload.replace('usr_creator_01', 'usr_creator_01_山田') },
        { name: 'Korean Hangul injection', mutated: baselinePayload.replace('usr_creator_01', 'usr_creator_01_홍길동') },
        { name: 'Arabic text RTL injection', mutated: baselinePayload.replace('usr_creator_01', 'usr_creator_01_مرحبا') },
        { name: 'Hebrew text RTL injection', mutated: baselinePayload.replace('usr_creator_01', 'usr_creator_01_שלום') },
        { name: 'Right-to-left override character', mutated: '\u202E' + baselinePayload + '\u202C' },
        { name: 'Left-to-right override character', mutated: '\u202D' + baselinePayload + '\u202C' },
        { name: 'Unicode normalization NFD', mutated: baselinePayload.normalize('NFD') },
        { name: 'Unicode normalization NFKD', mutated: baselinePayload.normalize('NFKD') },
        { name: 'Cyrillic homoglyph a instead of latin a', mutated: baselinePayload.replace('video', 'vidеo') }, // cyrillic 'е'
        { name: 'Greek homoglyph o instead of latin o', mutated: baselinePayload.replace('video', 'videο') }, // greek 'ο'
        { name: 'Latin small capital letter', mutated: baselinePayload.replace('marketing', 'm\u1D00rketing') },
        { name: 'Superscript number injection', mutated: baselinePayload.replace('180', '18⁰') },
        { name: 'Fraction glyph injection', mutated: baselinePayload.replace('180', '180½') },
        { name: 'En-dash instead of hyphen', mutated: baselinePayload.replace('4k_uhd', '4k–uhd') },
        { name: 'Em-dash instead of hyphen', mutated: baselinePayload.replace('4k_uhd', '4k—uhd') }
      );

      // Category D: Surrogate Pairs & Emoji Perturbations (15 mutations)
      mutations.push(
        { name: 'Rocket emoji inserted', mutated: baselinePayload.replace('4k_uhd', '4k_uhd_🚀') },
        { name: 'Emoji replaced with alternative', mutated: (baselinePayload + '🚀').replace('🚀', '🛸') },
        { name: 'Compound family emoji', mutated: baselinePayload + '👨‍👩‍👧‍👦' },
        { name: 'Rainbow flag emoji with ZWJ', mutated: baselinePayload + '🏳️‍🌈' },
        { name: 'Unpaired high surrogate at end', mutated: baselinePayload + '\uD83D' },
        { name: 'Unpaired low surrogate at end', mutated: baselinePayload + '\uDE80' },
        { name: 'Unpaired high surrogate inside key', mutated: baselinePayload.replace('id', 'i\uD83Dd') },
        { name: 'Inverted surrogate order', mutated: baselinePayload + '\uDE80\uD83D' },
        { name: 'Null byte injection in string', mutated: baselinePayload.replace('video.rendered', 'video\0rendered') },
        { name: 'Null byte prefix', mutated: '\0' + baselinePayload },
        { name: 'Null byte suffix', mutated: baselinePayload + '\0' },
        { name: 'Escaped null byte literal', mutated: baselinePayload.replace('video.rendered', 'video\\u0000rendered') },
        { name: 'Skin tone modifier emoji alone', mutated: baselinePayload + '\uD83C\uDFFB' },
        { name: 'Regional indicator symbol alone', mutated: baselinePayload + '\uD83C\uDDFB' },
        { name: 'Variation selector 16', mutated: baselinePayload + '\uFE0F' }
      );

      // Category E: Single-Bit Flips Across 50 Distinct Payload Positions (50 mutations)
      const step = Math.max(1, Math.floor(baselinePayload.length / 50));
      for (let bitIdx = 0; bitIdx < 50; bitIdx++) {
        const charPos = Math.min(baselinePayload.length - 1, bitIdx * step);
        const originalCharCode = baselinePayload.charCodeAt(charPos);
        const flippedChar = String.fromCharCode(originalCharCode ^ 1);
        const bitFlippedPayload =
          baselinePayload.slice(0, charPos) + flippedChar + baselinePayload.slice(charPos + 1);

        mutations.push({
          name: `Bit flip at character offset ${charPos} (char: ${JSON.stringify(baselinePayload[charPos])})`,
          mutated: bitFlippedPayload,
        });
      }

      // Category F: Security Injection Attacks (12 mutations)
      mutations.push(
        { name: 'SQL Injection tautology', mutated: baselinePayload.replace('evt_stress_adversarial_999888', "evt_' OR '1'='1") },
        { name: 'SQL Injection drop table', mutated: baselinePayload.replace('evt_stress_adversarial_999888', "evt_'; DROP TABLE organizations; --") },
        { name: 'XSS script injection', mutated: baselinePayload.replace('usr_creator_01', '<script>alert(1)</script>') },
        { name: 'XSS img error injection', mutated: baselinePayload.replace('usr_creator_01', '<img src=x onerror=alert(1)>') },
        { name: 'Prototype pollution __proto__', mutated: baselinePayload.slice(0, -1) + ',"__proto__":{"polluted":true}}' },
        { name: 'Constructor prototype pollution', mutated: baselinePayload.slice(0, -1) + ',"constructor":{"prototype":{"admin":true}}}' },
        { name: 'Path traversal attack', mutated: baselinePayload.replace('evt_stress_adversarial_999888', '../../../../etc/shadow') },
        { name: 'Command injection $() syntax', mutated: baselinePayload.replace('evt_stress_adversarial_999888', 'evt_$(id)') },
        { name: 'Command injection backtick syntax', mutated: baselinePayload.replace('evt_stress_adversarial_999888', 'evt_`cat /etc/passwd`') },
        { name: 'CRLF injection in payload', mutated: baselinePayload.replace('video.rendered', 'video.rendered\r\nX-Injected: true') },
        { name: 'HTML entity injection', mutated: baselinePayload.replace('video.rendered', '&lt;svg/onload=alert(1)&gt;') },
        { name: 'LDAP injection pattern', mutated: baselinePayload.replace('usr_creator_01', '*(|(mail=*))') }
      );

      // Category G: Truncation, Boundaries & Padding (10 mutations)
      mutations.push(
        { name: 'Truncated 1 character from end', mutated: baselinePayload.slice(0, -1) },
        { name: 'Truncated 5 characters from end', mutated: baselinePayload.slice(0, -5) },
        { name: 'Truncated 1 character from start', mutated: baselinePayload.slice(1) },
        { name: 'Truncated half payload', mutated: baselinePayload.slice(0, Math.floor(baselinePayload.length / 2)) },
        { name: 'Empty string payload', mutated: '' },
        { name: 'Single opening curly brace', mutated: '{' },
        { name: 'Single closing curly brace', mutated: '}' },
        { name: 'Two opening curly braces', mutated: '{{' },
        { name: '10KB padded with spaces', mutated: baselinePayload + ' '.repeat(10240) },
        { name: '10KB padded with zeroes', mutated: baselinePayload + '0'.repeat(10240) }
      );

      // Total generated mutations count check
      expect(mutations.length).toBeGreaterThanOrEqual(130);

      // Verify EVERY SINGLE mutation is rejected by verifyWebhookSignature
      let rejectedCount = 0;
      for (const mutation of mutations) {
        expect(mutation.mutated).not.toBe(baselinePayload);
        const isVerified = await verifyWebhookSignature(masterSecret, mutation.mutated, legitimateHeader);
        if (!isVerified) {
          rejectedCount++;
        } else {
          throw new Error(`CRITICAL SECURITY FAILURE: Mutation '${mutation.name}' was accepted as valid!`);
        }
      }

      expect(rejectedCount).toBe(mutations.length);
    });
  });

  // ============================================================================
  // 3. REPLAY ATTACK & CLOCK DRIFT TOLERANCE WINDOW (±300S)
  // ============================================================================
  describe('3. Replay Attack & Clock Drift Window (±300s)', () => {
    it('accepts signatures within the ±300s window and strictly rejects outside the window', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      // Within tolerance:
      // 1. Exactly current timestamp (0s drift)
      const currentHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, currentHeader)).toBe(true);

      // 2. now - 299s (lower edge within tolerance)
      const past299Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 299);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, past299Header)).toBe(true);

      // 3. now + 299s (upper edge within tolerance)
      const future299Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec + 299);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, future299Header)).toBe(true);

      // 4. now - 300s (exact lower boundary: Math.abs(300) > 300 is false)
      const past300Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 300);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, past300Header)).toBe(true);

      // 5. now + 300s (exact upper boundary: Math.abs(300) > 300 is false)
      const future300Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec + 300);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, future300Header)).toBe(true);

      // Outside tolerance (strictly rejected):
      // 6. now - 301s (stale replay breach)
      const past301Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 301);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, past301Header)).toBe(false);

      // 7. now + 301s (future drift breach)
      const future301Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec + 301);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, future301Header)).toBe(false);

      // 8. now - 3600s (1 hour old replay attack)
      const replay1hHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 3600);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, replay1hHeader)).toBe(false);

      // 9. now + 3600s (1 hour future timestamp attack)
      const future1hHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec + 3600);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, future1hHeader)).toBe(false);

      // 10. now - 86400s (1 day old replay attack)
      const replay1dHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 86400);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, replay1dHeader)).toBe(false);

      // 11. now - 31536000s (1 year old replay attack)
      const replay1yHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 31536000);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, replay1yHeader)).toBe(false);
    });

    it('tests boundary edge cases: tolerance = 0, negative tolerance, and malformed timestamps', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const exactNowHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec);
      const past1Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec - 1);
      const future1Header = await generateWebhookSignature(masterSecret, baselinePayload, nowSec + 1);

      // Tolerance = 0 edge case:
      // Exact current second passes
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, exactNowHeader, 0)).toBe(true);
      // Even 1 second difference is rejected
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, past1Header, 0)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, future1Header, 0)).toBe(false);

      // Negative tolerance edge case: Math.abs(...) > -1 is always true, rejecting all
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, exactNowHeader, -1)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, exactNowHeader, -300)).toBe(false);

      // Timestamp tampering in header string:
      const dummySig = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      // 1. timestamp = NaN
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=NaN,v1=${dummySig}`)).toBe(false);
      expect(parseSignatureHeader(`t=NaN,v1=${dummySig}`)).toBeNull();

      // 2. timestamp = Infinity
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=Infinity,v1=${dummySig}`)).toBe(false);
      expect(parseSignatureHeader(`t=Infinity,v1=${dummySig}`)).toBeNull();

      // 3. timestamp = -Infinity
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=-Infinity,v1=${dummySig}`)).toBe(false);
      expect(parseSignatureHeader(`t=-Infinity,v1=${dummySig}`)).toBeNull();

      // 4. Negative timestamp
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=-1717200000,v1=${dummySig}`)).toBe(false);
      expect(parseSignatureHeader(`t=-1717200000,v1=${dummySig}`)).toBeNull();

      // 5. timestamp = 0
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=0,v1=${dummySig}`)).toBe(false);
      expect(parseSignatureHeader(`t=0,v1=${dummySig}`)).toBeNull();

      // 6. Non-numeric strings
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=notanumber,v1=${dummySig}`)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=1717200000abc,v1=${dummySig}`)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=undefined,v1=${dummySig}`)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=null,v1=${dummySig}`)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=[object Object],v1=${dummySig}`)).toBe(false);
    });
  });

  // ============================================================================
  // 4. KEY AND HEADER FUZZING & DOS RESISTANCE
  // ============================================================================
  describe('4. Key and Header Fuzzing & Stress', () => {
    it('handles extreme secret variations: empty, null-bytes, 1KB, 16KB, and unicode', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      // 1. Empty secret: verify returns false, generate throws descriptive error
      expect(await verifyWebhookSignature('', baselinePayload, `t=${nowSec},v1=abc`)).toBe(false);
      await expect(generateWebhookSignature('', baselinePayload, nowSec)).rejects.toThrow(
        /INVALID_SIGNING_SECRET/
      );

      // 2. Secret with null bytes
      const nullByteSecret = 'whsec_\0null_\0byte_\0secret_test_2026';
      const nullHeader = await generateWebhookSignature(nullByteSecret, baselinePayload, nowSec);
      expect(await verifyWebhookSignature(nullByteSecret, baselinePayload, nullHeader)).toBe(true);
      expect(await verifyWebhookSignature(nullByteSecret, baselinePayload + 'x', nullHeader)).toBe(false);

      // 3. 1KB Secret (1024 chars)
      const oneKbSecret = 'k'.repeat(1024);
      const oneKbHeader = await generateWebhookSignature(oneKbSecret, baselinePayload, nowSec);
      expect(await verifyWebhookSignature(oneKbSecret, baselinePayload, oneKbHeader)).toBe(true);
      expect(await verifyWebhookSignature(oneKbSecret, baselinePayload + 'x', oneKbHeader)).toBe(false);

      // 4. 16KB Secret (16384 chars)
      const sixteenKbSecret = 'secret_chunk_'.repeat(1260); // > 16KB
      const sixteenKbHeader = await generateWebhookSignature(sixteenKbSecret, baselinePayload, nowSec);
      expect(await verifyWebhookSignature(sixteenKbSecret, baselinePayload, sixteenKbHeader)).toBe(true);
      expect(await verifyWebhookSignature(sixteenKbSecret, baselinePayload + 'x', sixteenKbHeader)).toBe(false);

      // 5. Unicode Secrets (Vietnamese diacritics, CJK, Arabic, emojis)
      const unicodeSecrets = [
        'whsec_khóa_tối_mật_tiếng_việt_2026_🔑_⚡️',
        'whsec_企业级加密密钥_保护系统_🔒_2026',
        'whsec_مفتاح_سري_عالي_الأمان_🛡️',
        '🚀🔥💎👑⚡️🛡️🌟✨🎯',
      ];

      for (const uSecret of unicodeSecrets) {
        const uHeader = await generateWebhookSignature(uSecret, baselinePayload, nowSec);
        expect(await verifyWebhookSignature(uSecret, baselinePayload, uHeader)).toBe(true);
        expect(await verifyWebhookSignature(uSecret, baselinePayload + 'tampered', uHeader)).toBe(false);
      }

      // 6. Non-string secret types passed unsafely
      expect(await verifyWebhookSignature(null as unknown as string, baselinePayload, `t=${nowSec},v1=abc`)).toBe(false);
      expect(await verifyWebhookSignature(undefined as unknown as string, baselinePayload, `t=${nowSec},v1=abc`)).toBe(false);
      expect(await verifyWebhookSignature(12345 as unknown as string, baselinePayload, `t=${nowSec},v1=abc`)).toBe(false);
      expect(await verifyWebhookSignature({} as unknown as string, baselinePayload, `t=${nowSec},v1=abc`)).toBe(false);
    });

    it('handles malformed, duplicate, reordered, and DoS header structures', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validHeader = await generateWebhookSignature(masterSecret, baselinePayload, nowSec);
      const sig = validHeader.split(',v1=')[1];

      // 1. Missing header
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, '')).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, null as unknown as string)).toBe(false);
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, undefined as unknown as string)).toBe(false);

      // 2. Missing v1= component
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=${nowSec}`)).toBe(false);
      expect(parseSignatureHeader(`t=${nowSec}`)).toBeNull();

      // 3. Missing t= component
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `v1=${sig}`)).toBe(false);
      expect(parseSignatureHeader(`v1=${sig}`)).toBeNull();

      // 4. Empty v1= value
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=${nowSec},v1=`)).toBe(false);
      expect(parseSignatureHeader(`t=${nowSec},v1=`)).toBeNull();

      // 5. Empty t= value
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, `t=,v1=${sig}`)).toBe(false);
      expect(parseSignatureHeader(`t=,v1=${sig}`)).toBeNull();

      // 6. Extra commas surrounding or between parameters (RFC / HTTP header resilience)
      const extraCommasHeader = `,,,,t=${nowSec},,,,v1=${sig},,,,`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, extraCommasHeader)).toBe(true);

      // 7. Reordered parameters (v1 first, then t)
      const reorderedHeader = `v1=${sig},t=${nowSec}`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, reorderedHeader)).toBe(true);

      // 8. Duplicate t= parameter (valid takes effect)
      // When first t is old and second t is valid
      const dupHeaderValidSecond = `t=100,t=${nowSec},v1=${sig}`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, dupHeaderValidSecond)).toBe(true);

      // When first t is valid and second t is invalid non-numeric
      const dupHeaderInvalidSecond = `t=${nowSec},t=corrupt,v1=${sig}`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, dupHeaderInvalidSecond)).toBe(true);

      // 9. Duplicate v1= parameter (second valid overwrites first invalid)
      const dupV1Header = `t=${nowSec},v1=invalidsig1234567890abcdef1234567890abcdef1234567890abcdef1234567890,v1=${sig}`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, dupV1Header)).toBe(true);

      // 10. Extra unrecognized header parameters
      const extraParamsHeader = `t=${nowSec},v1=${sig},scheme=v1,app=sophia,tier=master,region=vn-han`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, extraParamsHeader)).toBe(true);

      // 11. Heavy whitespace padding around tokens
      const heavyWhitespaceHeader = `   t   =   ${nowSec}   ,   v1   =   ${sig}   `;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, heavyWhitespaceHeader)).toBe(true);

      // 12. DoS Header Resistance: 1,000 extra commas
      const dosCommasHeader = ','.repeat(1000) + `t=${nowSec}` + ','.repeat(1000) + `v1=${sig}` + ','.repeat(1000);
      const t0 = performance.now();
      const dosResult = await verifyWebhookSignature(masterSecret, baselinePayload, dosCommasHeader);
      const t1 = performance.now();
      expect(dosResult).toBe(true);
      expect(t1 - t0).toBeLessThan(10); // must parse in under 10ms without regex catastrophic backtracking

      // 13. Oversized signature string (10KB invalid hex)
      const oversizedSig = 'f'.repeat(10240);
      const oversizedHeader = `t=${nowSec},v1=${oversizedSig}`;
      expect(await verifyWebhookSignature(masterSecret, baselinePayload, oversizedHeader)).toBe(false);
    });
  });
});
