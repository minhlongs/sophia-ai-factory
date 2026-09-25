/**
 * Unit Test Suite: 1-Click Sandboxed Demo Workspace Provisioner
 *
 * Validates:
 * 1. Web Crypto HMAC-SHA256 digital signature computation
 * 2. Magic access token generation and cryptographic verification
 * 3. Expiration detection and tampering protection
 * 4. Subaccount workspace isolation & 1,000 demo MCU allocation
 * 5. Deal stage transition to 'demo_active'
 *
 * @module __tests__/unit/enterprise/sandbox-provisioner.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  signHmacSha256,
  generateSandboxToken,
  verifySandboxToken,
  provisionDemoSandbox,
} from '@/tree/sales/sandbox-provisioner';
import { createEnterpriseDeal, getEnterpriseDealById } from '@/tree/sales/enterprise-deal-repo';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): any;
  };
};

describe('Sandbox Demo Provisioner — Unit Tests', () => {
  const TEST_SECRET = 'test-enterprise-hmac-secret-xyz';

  describe('HMAC-SHA256 & Token Cryptography', () => {
    it('computes deterministic HMAC-SHA256 signatures', async () => {
      const sig1 = await signHmacSha256('hello-world', TEST_SECRET);
      const sig2 = await signHmacSha256('hello-world', TEST_SECRET);
      expect(sig1).toBe(sig2);
      expect(sig1.length).toBe(64); // 256 bits = 64 hex characters

      const sigDifferentMessage = await signHmacSha256('hello-world-2', TEST_SECRET);
      expect(sigDifferentMessage).not.toBe(sig1);

      const sigDifferentSecret = await signHmacSha256('hello-world', 'different-key');
      expect(sigDifferentSecret).not.toBe(sig1);
    });

    it('generates and verifies valid sandbox tokens', async () => {
      const payload = {
        dealId: 'deal_123',
        subaccountId: 'sub_456',
        expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      };

      const token = await generateSandboxToken(payload, TEST_SECRET);
      expect(token).toContain('.');

      const result = await verifySandboxToken(token, TEST_SECRET);
      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.payload?.dealId).toBe('deal_123');
      expect(result.payload?.subaccountId).toBe('sub_456');
    });

    it('detects expired sandbox tokens', async () => {
      const expiredPayload = {
        dealId: 'deal_123',
        subaccountId: 'sub_456',
        expiresAt: Date.now() - 1000, // expired 1s ago
      };

      const token = await generateSandboxToken(expiredPayload, TEST_SECRET);
      const result = await verifySandboxToken(token, TEST_SECRET);
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('rejects tampered tokens', async () => {
      const payload = {
        dealId: 'deal_123',
        subaccountId: 'sub_456',
        expiresAt: Date.now() + 100000,
      };

      const token = await generateSandboxToken(payload, TEST_SECRET);
      const [b64, sig] = token.split('.');

      // Tamper with payload
      const tamperedToken = `${b64}tampered.${sig}`;
      const result = await verifySandboxToken(tamperedToken, TEST_SECRET);
      expect(result.valid).toBe(false);

      // Verify with wrong secret
      const wrongSecretResult = await verifySandboxToken(token, 'wrong-secret');
      expect(wrongSecretResult.valid).toBe(false);
    });
  });

  describe('1-Click Sandbox Workspace Provisioning in D1', () => {
    let rawDb: any;
    let d1: any;

    beforeEach(() => {
      rawDb = new DatabaseSync(':memory:');
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS client_subaccounts (
          id TEXT PRIMARY KEY,
          agency_org_id TEXT NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          custom_domain TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subaccount_branding (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          subaccount_id TEXT NOT NULL,
          logo_url TEXT,
          primary_color TEXT,
          accent_color TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
          id TEXT PRIMARY KEY,
          subaccount_id TEXT NOT NULL,
          allocated_mcu INTEGER NOT NULL DEFAULT 0,
          used_mcu INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS enterprise_deals (
          id TEXT PRIMARY KEY,
          lead_name TEXT NOT NULL,
          lead_email TEXT NOT NULL,
          lead_phone TEXT,
          lead_title TEXT,
          company_name TEXT NOT NULL,
          company_domain TEXT NOT NULL,
          lead_source TEXT NOT NULL DEFAULT 'website',
          deal_stage TEXT NOT NULL DEFAULT 'new_lead',
          pipeline_tier TEXT NOT NULL DEFAULT 'cold',
          deal_value_estimate_cents INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'USD',
          requested_mcu_monthly INTEGER NOT NULL DEFAULT 0,
          bant_score INTEGER NOT NULL DEFAULT 0,
          bant_budget_score INTEGER NOT NULL DEFAULT 0,
          bant_authority_score INTEGER NOT NULL DEFAULT 0,
          bant_need_score INTEGER NOT NULL DEFAULT 0,
          bant_timeline_score INTEGER NOT NULL DEFAULT 0,
          bant_analysis_json TEXT NOT NULL DEFAULT '{}',
          assigned_agent_id TEXT,
          assigned_agent_role TEXT NOT NULL DEFAULT 'ai_sales_executive',
          meeting_prep_brief TEXT,
          proposal_id TEXT,
          proposal_language TEXT NOT NULL DEFAULT 'en',
          proposal_content TEXT,
          sandbox_subaccount_id TEXT,
          sandbox_status TEXT NOT NULL DEFAULT 'none',
          sandbox_token TEXT,
          sandbox_expires_at INTEGER,
          notes TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );
      `);

      d1 = makeD1(rawDb);
    });

    it('provisions a 1,000 MCU sandboxed subaccount and activates demo', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Tech Lead',
        leadEmail: 'lead@alpha-media.com',
        companyName: 'Alpha Media Global',
        companyDomain: 'alpha-media.com',
        dealStage: 'qualified',
      });

      const sandbox = await provisionDemoSandbox(d1, deal.id, {
        secret: TEST_SECRET,
        baseUrl: 'https://test.sophia.network',
      });

      expect(sandbox.dealId).toBe(deal.id);
      expect(sandbox.allocatedMcu).toBe(1000);
      expect(sandbox.watermarkEnabled).toBe(true);
      expect(sandbox.demoMagicUrl).toContain('https://test.sophia.network/sandbox/');

      // Verify token
      const tokenVerification = await verifySandboxToken(sandbox.sandboxToken, TEST_SECRET);
      expect(tokenVerification.valid).toBe(true);

      // Verify deal status progression
      const updatedDeal = await getEnterpriseDealById(d1, deal.id);
      expect(updatedDeal).not.toBeNull();
      expect(updatedDeal!.sandboxStatus).toBe('active');
      expect(updatedDeal!.sandboxSubaccountId).toBe(sandbox.subaccountId);
      expect(updatedDeal!.dealStage).toBe('demo_active');
    });
  });
});
