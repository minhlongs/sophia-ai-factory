import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import type { AgencyOnboardingSubmission } from '@/seed/types';
import {
  validateOnboardingStepAction,
  submitAgencyOnboardingAction,
  getAgencyAdminOverviewAction,
  updateClientSubaccountStatusAction,
  reallocateClientMcuQuotaAction,
} from '../agency-portal-actions';

describe('Agency Portal & Onboarding Server Actions (D1 Integration)', () => {
  let db: NodeSqliteD1Database;

  beforeEach(() => {
    // 1. Initialize authentic in-memory SQLite D1 database
    db = new NodeSqliteD1Database(':memory:');
    db.exec('PRAGMA foreign_keys = OFF;');

    // 2. Create prerequisite organizations table and seed test agencies
    db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
      INSERT INTO organizations (id, name) VALUES
        ('org_nexus_agency', 'Nexus Agency'),
        ('agency_A', 'Agency A'),
        ('agency_B', 'Agency B'),
        ('agency_target', 'Target Agency'),
        ('agency_attacker', 'Attacker Agency');
    `);

    // 3. Load and execute migrations 0286 and 0436
    const m0286Path = path.resolve(
      __dirname,
      '../../../../migrations/0286_agency_multitenancy_subaccounts.sql'
    );
    const m0286Sql = fs.readFileSync(m0286Path, 'utf8');
    db.exec(m0286Sql);

    const m0436Path = path.resolve(
      __dirname,
      '../../../../migrations/0436_agent_governance_yaml_and_audit_ledger.sql'
    );
    const m0436Sql = fs.readFileSync(m0436Path, 'utf8');
    db.exec(m0436Sql);

    db.exec('PRAGMA foreign_keys = OFF;');

    // 4. Bind to global CF/D1 contexts
    (globalThis as Record<string, unknown>).__env__ = { DB: db };
    (globalThis as Record<string, unknown>).__D1_DB = db;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  describe('1. validateOnboardingStepAction', () => {
    it('validates step 1 (profile) correctly', async () => {
      const valid = await validateOnboardingStepAction(1, {
        clientName: 'Alpha Client',
        agencySlug: 'alpha-client',
        contactEmail: 'contact@alpha.com',
        industryTag: 'media',
        initialMcuBudget: 500,
      });
      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);

      const invalid = await validateOnboardingStepAction(1, {
        clientName: '',
        agencySlug: 'admin',
        contactEmail: 'bad-email',
        industryTag: 'media',
        initialMcuBudget: -10,
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    it('validates step 2 (branding) correctly', async () => {
      const valid = await validateOnboardingStepAction(2, {
        primaryColor: '#2563eb',
        accentColor: '#10b981',
      });
      expect(valid.valid).toBe(true);

      const invalid = await validateOnboardingStepAction(2, {
        primaryColor: 'not-a-color',
      });
      expect(invalid.valid).toBe(false);
    });
  });

  describe('2. submitAgencyOnboardingAction', () => {
    const validSubmission: AgencyOnboardingSubmission = {
      agencyOrgId: 'org_nexus_agency',
      profile: {
        clientName: 'Nexus Global',
        agencySlug: 'nexus-global',
        contactEmail: 'contact@nexus.com',
        industryTag: 'saas',
        initialMcuBudget: 2500,
      },
      branding: {
        logoUrl: 'https://cdn.example.com/logo.png',
        primaryColor: '#0f172a',
        accentColor: '#3b82f6',
      },
      domain: {
        customDomain: 'portal.nexusglobal.com',
      },
      seedAgents: [
        {
          agentId: 'nexus-vc-1',
          name: 'Nexus Video Creator',
          role: 'video_creator',
          template: 'ai-avatar-video-agency',
          maxAutonomy: 'L2',
          maxComputeUnitsMcu: 1000,
          escalationPolicy: 'request_approval',
          enabled: true,
        },
      ],
    };

    it('provisions subaccount, branding, quota, and AGY governance config', async () => {
      const res = await submitAgencyOnboardingAction(validSubmission, db);
      expect(res.success).toBe(true);
      expect(res.subaccountId).toBeDefined();
      expect(res.agencySlug).toBe('nexus-global');
      expect(res.portalUrl).toBe('/portal/nexus-global');
      expect(res.deployedAgentsCount).toBe(1);

      // Verify D1 records
      const subaccount = await db
        .prepare('SELECT * FROM client_subaccounts WHERE id = ?1')
        .bind(res.subaccountId)
        .first<{ name: string; slug: string; agency_org_id: string }>();
      expect(subaccount?.name).toBe('Nexus Global');
      expect(subaccount?.slug).toBe('nexus-global');
      expect(subaccount?.agency_org_id).toBe('org_nexus_agency');

      const branding = await db
        .prepare('SELECT * FROM subaccount_branding WHERE subaccount_id = ?1')
        .bind(res.subaccountId)
        .first<{ primary_color: string; accent_color: string }>();
      expect(branding?.primary_color).toBe('#0f172a');
      expect(branding?.accent_color).toBe('#3b82f6');

      const quota = await db
        .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?1')
        .bind(res.subaccountId)
        .first<{ allocated_mcu: number; used_mcu: number }>();
      expect(quota?.allocated_mcu).toBe(2500);
      expect(quota?.used_mcu).toBe(0);

      const agyConfig = await db
        .prepare('SELECT * FROM agy_governance_configs WHERE agent_id = ?1')
        .bind('nexus-vc-1')
        .first<{ schema_version: string; agency_id: string }>();
      expect(agyConfig?.schema_version).toBe('1.0');
      expect(agyConfig?.agency_id).toBe('org_nexus_agency');
    });

    it('rejects duplicate agency slug within the same agency organization', async () => {
      const res1 = await submitAgencyOnboardingAction(validSubmission, db);
      expect(res1.success).toBe(true);

      const res2 = await submitAgencyOnboardingAction(validSubmission, db);
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('SLUG_ALREADY_EXISTS');
    });
  });

  describe('3. getAgencyAdminOverviewAction & Tenant Isolation', () => {
    it('returns overview data isolated to the requesting agency', async () => {
      // 1. Onboard client for agency A
      await submitAgencyOnboardingAction(
        {
          agencyOrgId: 'agency_A',
          profile: {
            clientName: 'Client Alpha',
            agencySlug: 'client-alpha',
            contactEmail: 'a@alpha.com',
            industryTag: 'tech',
            initialMcuBudget: 1000,
          },
          branding: {},
          domain: {},
          seedAgents: [
            {
              agentId: 'a-1',
              name: 'Agent A',
              role: 'video_creator',
              template: 'ai-avatar-video-agency',
              maxAutonomy: 'L2',
              maxComputeUnitsMcu: 500,
              escalationPolicy: 'request_approval',
              enabled: true,
            },
          ],
        },
        db
      );

      // 2. Onboard client for agency B
      await submitAgencyOnboardingAction(
        {
          agencyOrgId: 'agency_B',
          profile: {
            clientName: 'Client Beta',
            agencySlug: 'client-beta',
            contactEmail: 'b@beta.com',
            industryTag: 'tech',
            initialMcuBudget: 2000,
          },
          branding: {},
          domain: {},
          seedAgents: [
            {
              agentId: 'b-1',
              name: 'Agent B',
              role: 'video_creator',
              template: 'ai-avatar-video-agency',
              maxAutonomy: 'L2',
              maxComputeUnitsMcu: 500,
              escalationPolicy: 'request_approval',
              enabled: true,
            },
          ],
        },
        db
      );

      // Query overview for agency A
      const overviewA = await getAgencyAdminOverviewAction('agency_A', undefined, db);
      expect(overviewA.clients).toHaveLength(1);
      expect(overviewA.clients[0].name).toBe('Client Alpha');
      expect(overviewA.kpi.totalActiveClients).toBe(1);
      expect(overviewA.kpi.totalAllocatedMcu).toBe(1000);

      // Query overview for agency B
      const overviewB = await getAgencyAdminOverviewAction('agency_B', undefined, db);
      expect(overviewB.clients).toHaveLength(1);
      expect(overviewB.clients[0].name).toBe('Client Beta');
      expect(overviewB.kpi.totalActiveClients).toBe(1);
      expect(overviewB.kpi.totalAllocatedMcu).toBe(2000);
    });
  });

  describe('4. updateClientSubaccountStatusAction & reallocateClientMcuQuotaAction', () => {
    it('updates status and protects against cross-tenant tampering', async () => {
      const onboardRes = await submitAgencyOnboardingAction(
        {
          agencyOrgId: 'agency_target',
          profile: {
            clientName: 'Target Client',
            agencySlug: 'target-client',
            contactEmail: 'target@client.com',
            industryTag: 'retail',
            initialMcuBudget: 500,
          },
          branding: {},
          domain: {},
          seedAgents: [
            {
              agentId: 't-1',
              name: 'Target Agent',
              role: 'video_creator',
              template: 'ai-avatar-video-agency',
              maxAutonomy: 'L2',
              maxComputeUnitsMcu: 500,
              escalationPolicy: 'request_approval',
              enabled: true,
            },
          ],
        },
        db
      );

      const subId = onboardRes.subaccountId!;

      // Attacker agency attempts to suspend client
      const attackRes = await updateClientSubaccountStatusAction(subId, 'agency_attacker', 'suspended', db);
      expect(attackRes.success).toBe(false);

      // Legitimate agency suspends client
      const legitRes = await updateClientSubaccountStatusAction(subId, 'agency_target', 'suspended', db);
      expect(legitRes.success).toBe(true);

      // Verify suspended in DB
      const row = await db
        .prepare('SELECT status FROM client_subaccounts WHERE id = ?1')
        .bind(subId)
        .first<{ status: string }>();
      expect(row?.status).toBe('suspended');

      // Reallocate MCU quota with legitimate agency
      const reallocRes = await reallocateClientMcuQuotaAction(subId, 'agency_target', 1500, db);
      expect(reallocRes.success).toBe(true);
      expect(reallocRes.remainingMcu).toBe(1500);

      // Reallocate MCU quota with attacker agency fails
      const attackRealloc = await reallocateClientMcuQuotaAction(subId, 'agency_attacker', 9999, db);
      expect(attackRealloc.success).toBe(false);
    });
  });
});
