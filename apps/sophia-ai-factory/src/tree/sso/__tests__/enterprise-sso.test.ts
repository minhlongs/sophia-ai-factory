/**
 * Unit & Integration Tests for Enterprise Multi-Org SAML/OIDC SSO
 *
 * Verifies:
 * 1. Corporate domain normalization and extraction
 * 2. Enterprise domain validation & public consumer webmail blocklist
 * 3. AES-256-GCM client secret encryption and decryption
 * 4. D1 SSO configuration CRUD and domain uniqueness
 * 5. Dynamic IdP routing metadata resolution from user email
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
  getEnterpriseSsoByOrg,
  getEnterpriseSsoById,
  updateEnterpriseSsoConfig,
  deleteEnterpriseSsoConfig,
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

function createTestD1(): D1Database {
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

describe('Enterprise Multi-Org SSO Service', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestD1();

    // Seed test org
    await db
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?1, ?2, ?3)')
      .bind('org_acme', 'Acme Corporation Global', Math.floor(Date.now() / 1000))
      .run();
  });

  describe('1. Corporate Domain Normalization', () => {
    it('normalizes domains from emails, protocols, and whitespace', () => {
      expect(normalizeCorporateDomain('alice@AcmeCorp.COM')).toBe('acmecorp.com');
      expect(normalizeCorporateDomain('  @AcmeCorp.COM  ')).toBe('acmecorp.com');
      expect(normalizeCorporateDomain('https://sso.enterprise.io/login')).toBe('sso.enterprise.io');
      expect(normalizeCorporateDomain('http://corp.net:8080/')).toBe('corp.net');
      expect(normalizeCorporateDomain('...mycompany.org...')).toBe('mycompany.org');
    });

    it('returns empty string for invalid inputs', () => {
      expect(normalizeCorporateDomain('')).toBe('');
      expect(normalizeCorporateDomain(null as unknown as string)).toBe('');
    });
  });

  describe('2. Corporate Domain Validation & Blocklist', () => {
    it('accepts legitimate corporate domains', () => {
      expect(isCorporateEmailDomain('acme.com')).toBe(true);
      expect(isCorporateEmailDomain('john@tech-corp.io')).toBe(true);
      expect(isCorporateEmailDomain('corp.agency.vn')).toBe(true);
      expect(isCorporateEmailDomain('global-holdings.co.uk')).toBe(true);
    });

    it('rejects public consumer webmail providers', () => {
      expect(isCorporateEmailDomain('user@gmail.com')).toBe(false);
      expect(isCorporateEmailDomain('user@googlemail.com')).toBe(false);
      expect(isCorporateEmailDomain('user@yahoo.com')).toBe(false);
      expect(isCorporateEmailDomain('user@outlook.com')).toBe(false);
      expect(isCorporateEmailDomain('user@hotmail.com')).toBe(false);
      expect(isCorporateEmailDomain('user@proton.me')).toBe(false);
      expect(isCorporateEmailDomain('user@icloud.com')).toBe(false);
    });

    it('rejects invalid or malformed domain syntax', () => {
      expect(isCorporateEmailDomain('nodot')).toBe(false);
      expect(isCorporateEmailDomain('invalid..domain.com')).toBe(false);
      expect(isCorporateEmailDomain('.com')).toBe(false);
    });
  });

  describe('3. AES-256-GCM Client Secret Encryption', () => {
    it('encrypts and successfully decrypts client secrets', () => {
      const secret = 'super_sensitive_client_secret_xyz123!';
      const encrypted = encryptClientSecret(secret);

      expect(encrypted).toMatch(/^aes-gcm:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
      expect(encrypted).not.toContain(secret);

      const decrypted = decryptClientSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('returns null on tampered or corrupted encrypted secret', () => {
      const forged = 'aes-gcm:invalid_iv:invalid_tag:invalid_ciphertext';
      const decrypted = decryptClientSecret(forged);
      expect(decrypted).toBeNull();
    });
  });

  describe('4. D1 SSO Configuration Management', () => {
    it('creates an enterprise SAML configuration with encrypted secret', async () => {
      const config = await saveEnterpriseSsoConfig(db, {
        orgId: 'org_acme',
        domain: 'acme.com',
        providerType: 'saml',
        issuer: 'https://login.microsoftonline.com/acme-tenant-id/v2.0',
        clientId: 'azure-client-id-123',
        clientSecret: 'secret-azure-token',
        ssoUrl: 'https://login.microsoftonline.com/acme-tenant-id/saml2',
        certificate: 'MIICXAIBAAKCAQEA...',
      });

      expect(config.id).toBeDefined();
      expect(config.domain).toBe('acme.com');
      expect(config.providerType).toBe('saml');
      expect(config.clientSecretEncrypted).toMatch(/^aes-gcm:/);
      expect(config.enabled).toBe(true);

      const fetched = await getEnterpriseSsoById(db, config.id);
      expect(fetched?.domain).toBe('acme.com');
    });

    it('prevents registration of consumer webmail domains', async () => {
      await expect(
        saveEnterpriseSsoConfig(db, {
          orgId: 'org_acme',
          domain: 'gmail.com',
          providerType: 'oidc',
          issuer: 'https://accounts.google.com',
          clientId: 'client-1',
        }),
      ).rejects.toThrow(/Invalid corporate email domain/);
    });

    it('prevents domain collisions across different organizations', async () => {
      await saveEnterpriseSsoConfig(db, {
        orgId: 'org_acme',
        domain: 'acme.com',
        providerType: 'saml',
        issuer: 'https://issuer1.com',
        clientId: 'client-1',
      });

      await expect(
        saveEnterpriseSsoConfig(db, {
          orgId: 'org_other',
          domain: 'acme.com',
          providerType: 'saml',
          issuer: 'https://issuer2.com',
          clientId: 'client-2',
        }),
      ).rejects.toThrow(/already claimed by another organization/);
    });

    it('lists and updates SSO configs for an organization', async () => {
      const created = await saveEnterpriseSsoConfig(db, {
        orgId: 'org_acme',
        domain: 'acme.io',
        providerType: 'oidc',
        issuer: 'https://auth.acme.io',
        clientId: 'client-oidc',
      });

      const list = await getEnterpriseSsoByOrg(db, 'org_acme');
      expect(list.some((c) => c.id === created.id)).toBe(true);

      const updated = await updateEnterpriseSsoConfig(db, created.id, 'org_acme', {
        clientId: 'client-oidc-updated',
        enabled: false,
      });

      expect(updated?.clientId).toBe('client-oidc-updated');
      expect(updated?.enabled).toBe(false);
    });

    it('deletes SSO config cleanly', async () => {
      const config = await saveEnterpriseSsoConfig(db, {
        orgId: 'org_acme',
        domain: 'delete-me.com',
        providerType: 'saml',
        issuer: 'https://issuer.com',
        clientId: 'client-1',
      });

      const deleted = await deleteEnterpriseSsoConfig(db, config.id, 'org_acme');
      expect(deleted).toBe(true);

      const after = await getEnterpriseSsoById(db, config.id);
      expect(after).toBeNull();
    });
  });

  describe('5. Dynamic IdP Routing', () => {
    beforeEach(async () => {
      await saveEnterpriseSsoConfig(db, {
        orgId: 'org_acme',
        domain: 'acmecorp.com',
        providerType: 'saml',
        issuer: 'https://accounts.google.com/o/saml2/idp',
        clientId: 'google-saml-client',
        ssoUrl: 'https://accounts.google.com/o/saml2/idp?idpid=C012345',
      });
    });

    it('resolves corporate IdP routing from user email', async () => {
      const routing = await resolveIdpRouting(db, 'employee@acmecorp.com');

      expect(routing).not.toBeNull();
      expect(routing?.domain).toBe('acmecorp.com');
      expect(routing?.providerType).toBe('saml');
      expect(routing?.ssoUrl).toBe('https://accounts.google.com/o/saml2/idp?idpid=C012345');
      expect(routing?.orgId).toBe('org_acme');
      expect(routing?.orgName).toBe('Acme Corporation Global');
    });

    it('returns null for unregistered domains or consumer emails', async () => {
      const unknown = await resolveIdpRouting(db, 'user@unknown-domain.com');
      expect(unknown).toBeNull();

      const consumer = await resolveIdpRouting(db, 'user@gmail.com');
      expect(consumer).toBeNull();
    });
  });
});
