/**
 * Challenger M2 Adversarial Stress Test Suite: Enterprise SSO & Corporate Domain Routing
 *
 * EMPIRICAL ADVERSARIAL VERIFICATION:
 * 1. Consumer Email Domain Rejection:
 *    - Rejection of gmail.com, googlemail.com, yahoo.com, outlook.com, hotmail.com, etc.
 *    - Enforcement in domain validator and saveEnterpriseSsoConfig
 * 2. Malformed Domain Inputs:
 *    - Empty strings, whitespace, no dots, double dots, leading/trailing hyphens
 *    - XSS / SQL Injection payloads in domain fields
 *    - Raw IP addresses (IPv4 / IPv6)
 *    - Maximum FQDN boundary tests (253 chars, label length 63 chars)
 * 3. Uppercase & Mixed-Case Normalization:
 *    - Uppercase emails, URLs with protocols, ports, and trailing paths
 *    - Case-insensitive IdP lookup
 * 4. Internationalized Domains & Punycode:
 *    - Valid Punycode ASCII labels (xn--...)
 *    - Non-ASCII raw Unicode behavior
 * 5. AES-256-GCM Cryptographic Client Secret Security:
 *    - Ciphertext structure (aes-gcm:iv:tag:data)
 *    - Ciphertext single-bit corruption detection (GCM auth tag rejection)
 *    - Auth tag corruption detection
 *    - IV corruption detection
 *    - Non-deterministic IV uniqueness across encryptions
 *
 * Layer: tree (Adversarial Test Suite)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  normalizeCorporateDomain,
  isCorporateEmailDomain,
  encryptClientSecret,
  decryptClientSecret,
  saveEnterpriseSsoConfig,
  getEnterpriseSsoByDomain,
  resolveIdpRouting,
} from '../enterprise-sso-service';

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

function createAdversarialD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_sso_configs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      provider_type TEXT NOT NULL,
      issuer TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret_encrypted TEXT,
      metadata_url TEXT,
      sso_url TEXT,
      certificate TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() =>
          stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

describe('Challenger M2: Enterprise SSO Corporate Domain Routing & Encryption Stress', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createAdversarialD1();

    await db
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?1, ?2, ?3)')
      .bind('org_cyber_corp', 'Cyberdyne Systems Global', 1710000000)
      .run();
  });

  describe('1. Comprehensive Consumer Email Domain Rejection', () => {
    const consumerDomains = [
      'gmail.com',
      'googlemail.com',
      'yahoo.com',
      'yahoo.co.uk',
      'yahoo.fr',
      'yahoo.co.jp',
      'outlook.com',
      'hotmail.com',
      'hotmail.co.uk',
      'live.com',
      'msn.com',
      'icloud.com',
      'me.com',
      'mac.com',
      'aol.com',
      'proton.me',
      'protonmail.com',
      'zoho.com',
      'mail.com',
      'gmx.com',
      'gmx.net',
      'yandex.com',
      'yandex.ru',
      'fastmail.com',
      'tutanota.com',
      'tuta.com',
    ];

    consumerDomains.forEach((domain) => {
      it(`blocks consumer webmail domain: ${domain}`, () => {
        expect(isCorporateEmailDomain(domain)).toBe(false);
        expect(isCorporateEmailDomain(`employee@${domain}`)).toBe(false);
      });

      it(`rejects registration of ${domain} in saveEnterpriseSsoConfig`, async () => {
        await expect(
          saveEnterpriseSsoConfig(db, {
            orgId: 'org_cyber_corp',
            domain,
            providerType: 'oidc',
            issuer: 'https://auth.provider.com',
            clientId: 'client_123',
          }),
        ).rejects.toThrow(/Invalid corporate email domain/);
      });
    });
  });

  describe('2. Malformed Domain Inputs & Security Injection Stress', () => {
    const adversarialMalformedInputs = [
      '',
      '   ',
      'localhost',
      'internal_host',
      'acme',
      'acme..com',
      'test...sub..corp.com',
      '-leading-dash.com',
      'trailing-dash-.com',
      'acme!corp.com',
      'acme<script>alert(1)</script>.com',
      "acme' OR '1'='1.com",
      'acme;DROP TABLE users;--.com',
      '192.168.1.1',
      '127.0.0.1',
      '10.0.0.1',
      '[::1]',
      'a.c', // TLD length 1 (<2)
      'acme.123', // numeric TLD
      'acme.-invalid.com',
    ];

    adversarialMalformedInputs.forEach((input) => {
      it(`strictly rejects malformed / hostile domain input: "${input}"`, () => {
        expect(isCorporateEmailDomain(input)).toBe(false);
      });
    });

    it('sanitizes leading and trailing dots in normalization while maintaining corporate validation', () => {
      expect(normalizeCorporateDomain('..acme.com..')).toBe('acme.com');
      expect(isCorporateEmailDomain('..acme.com..')).toBe(true);
      // but internal multiple dots are not stripped and must fail
      expect(isCorporateEmailDomain('acme..corp.com')).toBe(false);
    });

    it('rejects domain exceeding maximum RFC 1035 length (253 characters)', () => {
      const longSubdomain = 'a'.repeat(60);
      const longDomain = `${longSubdomain}.${longSubdomain}.${longSubdomain}.${longSubdomain}.${longSubdomain}.com`; // 308 chars (>253)
      expect(longDomain.length).toBeGreaterThan(253);
      expect(isCorporateEmailDomain(longDomain)).toBe(false);
    });

    it('rejects domain label exceeding 63 characters', () => {
      const invalidLabel = 'a'.repeat(64);
      const domain = `${invalidLabel}.com`;
      expect(isCorporateEmailDomain(domain)).toBe(false);
    });
  });

  describe('3. Uppercase, Mixed-Case & URI Formatting Normalization', () => {
    it('normalizes uppercase emails and mixed-case domain strings to lowercase', () => {
      expect(normalizeCorporateDomain('USER@CYBERDYNE-CORP.COM')).toBe('cyberdyne-corp.com');
      expect(normalizeCorporateDomain('  Alice.Wong@Enterprise.Acme.VN  ')).toBe('enterprise.acme.vn');
      expect(normalizeCorporateDomain('https://IDP.CORP.NET:8443/oauth2/callback')).toBe('idp.corp.net');
    });

    it('correctly routes uppercase email against stored lowercase domain in IdP resolution', async () => {
      await saveEnterpriseSsoConfig(db, {
        orgId: 'org_cyber_corp',
        domain: 'CYBERDYNE-CORP.COM', // Provided in uppercase
        providerType: 'saml',
        issuer: 'https://login.microsoftonline.com/tenant-123',
        clientId: 'entra-id-client',
        ssoUrl: 'https://login.microsoftonline.com/tenant-123/saml2',
      });

      // User enters uppercase or mixed-case email during login
      const routing = await resolveIdpRouting(db, 'EXECUTIVE_VP@Cyberdyne-Corp.COM');
      expect(routing).not.toBeNull();
      expect(routing?.domain).toBe('cyberdyne-corp.com');
      expect(routing?.providerType).toBe('saml');
      expect(routing?.ssoUrl).toBe('https://login.microsoftonline.com/tenant-123/saml2');
      expect(routing?.orgName).toBe('Cyberdyne Systems Global');
    });
  });

  describe('4. Internationalized Domains & Punycode Handling', () => {
    it('accepts valid Punycode domains with standard ASCII TLDs', () => {
      // münchen.de in Punycode: xn--mnchen-3ya.de
      expect(isCorporateEmailDomain('xn--mnchen-3ya.de')).toBe(true);
      expect(isCorporateEmailDomain('admin@xn--mnchen-3ya.de')).toBe(true);

      // bücher.com in Punycode: xn--bcher-kva.com
      expect(isCorporateEmailDomain('contact@xn--bcher-kva.com')).toBe(true);

      // frobisher in Punycode
      expect(isCorporateEmailDomain('user@xn--frobisher-4y0a.com')).toBe(true);
    });

    it('rejects raw Unicode non-ASCII before Punycode conversion (enforces ASCII RFC hostname standard)', () => {
      // Raw non-ASCII characters fail DOMAIN_REGEX as expected before conversion
      expect(isCorporateEmailDomain('münchen.de')).toBe(false);
      expect(isCorporateEmailDomain('nghiệp-vụ.vn')).toBe(false);
    });

    it('documents Punycode TLD behavior (standard /^[a-z]+$/ requirement)', () => {
      // Internationalized TLDs like .рф (xn--p1ai) contain digits/hyphens and are rejected by ASCII-only TLD check
      expect(isCorporateEmailDomain('example.xn--p1ai')).toBe(false);
    });
  });

  describe('5. AES-256-GCM Cryptographic Client Secret Encryption Stress', () => {
    const sensitiveSecret = 'sec_prod_live_azure_entraid_super_secret_key_999!';

    it('produces standard 4-part AES-GCM serialization (aes-gcm:iv:tag:data)', () => {
      const encrypted = encryptClientSecret(sensitiveSecret);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('aes-gcm');
      // IV is 12 bytes = 16 base64 chars
      expect(Buffer.from(parts[1], 'base64')).toHaveLength(12);
      // Auth tag is 16 bytes = 24 base64 chars (with padding) or 22/24 chars
      expect(Buffer.from(parts[2], 'base64')).toHaveLength(16);
      // Data length > 0
      expect(Buffer.from(parts[3], 'base64').length).toBeGreaterThan(0);
    });

    it('guarantees IV freshness (non-deterministic output for identical inputs)', () => {
      const enc1 = encryptClientSecret(sensitiveSecret);
      const enc2 = encryptClientSecret(sensitiveSecret);

      expect(enc1).not.toBe(enc2);
      expect(decryptClientSecret(enc1)).toBe(sensitiveSecret);
      expect(decryptClientSecret(enc2)).toBe(sensitiveSecret);
    });

    it('AUTHENTICATED CIPHER CHALLENGE: Tampering 1 byte in ciphertext causes decryption to return null', () => {
      const encrypted = encryptClientSecret(sensitiveSecret);
      const parts = encrypted.split(':');

      const dataBuf = Buffer.from(parts[3], 'base64');
      // Flip a bit in the first byte
      dataBuf[0] ^= 0x01;
      parts[3] = dataBuf.toString('base64');

      const tampered = parts.join(':');
      const result = decryptClientSecret(tampered);

      // AES-256-GCM MUST reject corrupted ciphertext
      expect(result).toBeNull();
    });

    it('AUTHENTICATED CIPHER CHALLENGE: Tampering 1 byte in auth tag causes decryption to return null', () => {
      const encrypted = encryptClientSecret(sensitiveSecret);
      const parts = encrypted.split(':');

      const tagBuf = Buffer.from(parts[2], 'base64');
      // Flip a bit in auth tag
      tagBuf[0] ^= 0x01;
      parts[2] = tagBuf.toString('base64');

      const tampered = parts.join(':');
      const result = decryptClientSecret(tampered);

      expect(result).toBeNull();
    });

    it('AUTHENTICATED CIPHER CHALLENGE: Tampering IV causes decryption to return null', () => {
      const encrypted = encryptClientSecret(sensitiveSecret);
      const parts = encrypted.split(':');

      const ivBuf = Buffer.from(parts[1], 'base64');
      // Flip a bit in IV
      ivBuf[0] ^= 0x01;
      parts[1] = ivBuf.toString('base64');

      const tampered = parts.join(':');
      const result = decryptClientSecret(tampered);

      expect(result).toBeNull();
    });

    it('handles null, undefined, empty string, and legacy plaintext gracefully', () => {
      expect(encryptClientSecret('')).toBe('');
      expect(decryptClientSecret('')).toBeNull();
      expect(decryptClientSecret(null)).toBeNull();
      expect(decryptClientSecret(undefined)).toBeNull();
      // Legacy unencrypted secret fallback
      expect(decryptClientSecret('legacy_plain_secret')).toBe('legacy_plain_secret');
    });
  });
});
