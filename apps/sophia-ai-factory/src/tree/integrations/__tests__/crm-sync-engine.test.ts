/**
 * CRM Sync Engine Unit & Integration Test Suite
 *
 * Verifies:
 * - Salesforce Opportunity two-way mapping & stage conversions.
 * - HubSpot Deal two-way mapping & stage conversions.
 * - Decimal amount <-> integer cents conversion precision.
 * - LWW conflict resolution with Sophia authority bias on closed contracts.
 * - In-memory SQLite D1 database persistence for configs and sync events.
 *
 * @vitest-environment node
 * @module tree/integrations/__tests__/crm-sync-engine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import type {
  SophiaDealSnapshot,
  SalesforceOpportunityPayload,
  HubSpotDealPayload,
} from '../types';
import {
  centsToDecimalAmount,
  decimalAmountToCents,
  transformSophiaToSalesforce,
  transformSalesforceToSophia,
  transformSophiaToHubSpot,
  transformHubSpotToSophia,
  resolveCrmConflict,
  saveCrmConfig,
  getCrmConfig,
  listCrmConfigs,
  recordCrmSyncEvent,
  updateCrmSyncEvent,
  listCrmSyncEvents,
  SOPHIA_TO_SALESFORCE_STAGE_MAP,
  SALESFORCE_TO_SOPHIA_STAGE_MAP,
  SOPHIA_TO_HUBSPOT_STAGE_MAP,
  HUBSPOT_TO_SOPHIA_STAGE_MAP,
} from '../crm-sync-engine';

function createMockD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS enterprise_crm_configs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('salesforce', 'hubspot', 'zapier', 'custom')),
      api_endpoint TEXT,
      client_id TEXT,
      client_secret_encrypted TEXT,
      refresh_token_encrypted TEXT,
      access_token_encrypted TEXT,
      token_expires_at INTEGER,
      sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK(sync_direction IN ('inbound', 'outbound', 'bidirectional')),
      is_active INTEGER NOT NULL DEFAULT 1,
      field_mapping_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(tenant_id, provider)
    );

    CREATE TABLE IF NOT EXISTS crm_sync_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      crm_config_id TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('deal', 'opportunity', 'contact', 'lead', 'invoice')),
      entity_id TEXT NOT NULL,
      external_id TEXT,
      direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'synced', 'failed', 'ignored')),
      payload_json TEXT NOT NULL,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER,
      synced_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (crm_config_id) REFERENCES enterprise_crm_configs(id)
    );
  `);

  const d1Wrapper = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const res = stmt.get(...args);
              return (res ?? null) as T;
            },
            async all<T>(): Promise<{ results: T[] }> {
              const res = stmt.all(...args);
              return { results: res as T[] };
            },
            async run(): Promise<{ success: boolean; meta: { changes: number } }> {
              const info = stmt.run(...args);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
  };

  return d1Wrapper as unknown as D1Database;
}

describe('CRM Sync Engine', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createMockD1();
  });

  describe('Value Conversion Precision', () => {
    it('converts integer cents to decimal amounts accurately', () => {
      expect(centsToDecimalAmount(0)).toBe(0);
      expect(centsToDecimalAmount(100)).toBe(1.0);
      expect(centsToDecimalAmount(1599)).toBe(15.99);
      expect(centsToDecimalAmount(25000000)).toBe(250000.0);
      expect(centsToDecimalAmount(-100)).toBe(0);
    });

    it('converts decimal amounts to integer cents without floating point drift', () => {
      expect(decimalAmountToCents(0)).toBe(0);
      expect(decimalAmountToCents(1.0)).toBe(100);
      expect(decimalAmountToCents(19.99)).toBe(1999);
      expect(decimalAmountToCents('2500.50')).toBe(250050);
      expect(decimalAmountToCents(undefined)).toBe(0);
      expect(decimalAmountToCents(null)).toBe(0);
    });
  });

  describe('Salesforce Opportunity Adapter', () => {
    it('maps all 7 standard Sophia stages to Salesforce Opportunity stages', () => {
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.new_lead).toBe('Prospecting');
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.qualified).toBe('Qualification');
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.demo_prepared).toBe('Needs Analysis');
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.demo_active).toBe('Value Proposition');
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.proposal_sent).toBe('Proposal/Price Quote');
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.closed_won).toBe('Closed Won');
      expect(SOPHIA_TO_SALESFORCE_STAGE_MAP.closed_lost).toBe('Closed Lost');
    });

    it('maps Salesforce Opportunity stages back to Sophia deal stages', () => {
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP.Prospecting).toBe('new_lead');
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP.Qualification).toBe('qualified');
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP['Needs Analysis']).toBe('demo_prepared');
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP['Value Proposition']).toBe('demo_active');
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP['Proposal/Price Quote']).toBe('proposal_sent');
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP['Closed Won']).toBe('closed_won');
      expect(SALESFORCE_TO_SOPHIA_STAGE_MAP['Closed Lost']).toBe('closed_lost');
    });

    it('transforms a full Sophia deal into a Salesforce Opportunity payload', () => {
      const deal: SophiaDealSnapshot = {
        id: 'deal_12345',
        companyName: 'Acme Corp APAC',
        companyDomain: 'acme.com.vn',
        dealStage: 'proposal_sent',
        dealValueEstimateCents: 5000000, // $50,000.00
        currency: 'USD',
        leadName: 'Nguyen Van A',
        leadEmail: 'a.nguyen@acme.com.vn',
        leadPhone: '+84901234567',
        closeDate: '2027-10-15',
        notes: 'Requested custom SLA and dedicated GPU lane',
      };

      const sf = transformSophiaToSalesforce(deal);

      expect(sf.Sophia_Deal_Id__c).toBe('deal_12345');
      expect(sf.Name).toBe('Acme Corp APAC - Enterprise AI');
      expect(sf.StageName).toBe('Proposal/Price Quote');
      expect(sf.Amount).toBe(50000.0);
      expect(sf.CurrencyIsoCode).toBe('USD');
      expect(sf.CloseDate).toBe('2027-10-15');
      expect(sf.Contact_Email__c).toBe('a.nguyen@acme.com.vn');
      expect(sf.Contact_Phone__c).toBe('+84901234567');
      expect(sf.Account_Domain__c).toBe('acme.com.vn');
      expect(sf.Description).toBe('Requested custom SLA and dedicated GPU lane');
    });

    it('transforms an incoming Salesforce Opportunity payload into a partial Sophia deal', () => {
      const sfOpp: SalesforceOpportunityPayload = {
        Sophia_Deal_Id__c: 'deal_999',
        Name: 'Global Media Corp',
        StageName: 'Closed Won',
        Amount: 120000.5,
        CurrencyIsoCode: 'USD',
        CloseDate: '2027-12-01',
        Contact_Email__c: 'vp@globalmedia.com',
        Contact_Phone__c: '+14155550199',
        Account_Domain__c: 'globalmedia.com',
        Description: 'Contract finalized and signed',
      };

      const sophia = transformSalesforceToSophia(sfOpp);

      expect(sophia.id).toBe('deal_999');
      expect(sophia.dealStage).toBe('closed_won');
      expect(sophia.dealValueEstimateCents).toBe(12000050);
      expect(sophia.currency).toBe('USD');
      expect(sophia.closeDate).toBe('2027-12-01');
      expect(sophia.leadEmail).toBe('vp@globalmedia.com');
      expect(sophia.leadPhone).toBe('+14155550199');
      expect(sophia.companyDomain).toBe('globalmedia.com');
      expect(sophia.notes).toBe('Contract finalized and signed');
    });
  });

  describe('HubSpot Deal Adapter', () => {
    it('maps all 7 standard Sophia stages to HubSpot deal stages', () => {
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.new_lead).toBe('appointmentscheduled');
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.qualified).toBe('qualifiedtobuy');
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.demo_prepared).toBe('presentationscheduled');
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.demo_active).toBe('decisionmakerboughtin');
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.proposal_sent).toBe('contractsent');
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.closed_won).toBe('closedwon');
      expect(SOPHIA_TO_HUBSPOT_STAGE_MAP.closed_lost).toBe('closedlost');
    });

    it('maps HubSpot deal stages back to Sophia deal stages', () => {
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.appointmentscheduled).toBe('new_lead');
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.qualifiedtobuy).toBe('qualified');
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.presentationscheduled).toBe('demo_prepared');
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.decisionmakerboughtin).toBe('demo_active');
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.contractsent).toBe('proposal_sent');
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.closedwon).toBe('closed_won');
      expect(HUBSPOT_TO_SOPHIA_STAGE_MAP.closedlost).toBe('closed_lost');
    });

    it('transforms a full Sophia deal into a HubSpot Deal payload', () => {
      const deal: SophiaDealSnapshot = {
        id: 'deal_hs_77',
        companyName: 'Tokyo AI Studio',
        companyDomain: 'tokyo-ai.jp',
        dealStage: 'demo_active',
        dealValueEstimateCents: 850000, // $8,500.00
        currency: 'USD',
        leadEmail: 'tanaka@tokyo-ai.jp',
        closeDate: '2027-11-20',
      };

      const hs = transformSophiaToHubSpot(deal);

      expect(hs.sophia_deal_id).toBe('deal_hs_77');
      expect(hs.dealname).toBe('Tokyo AI Studio - Enterprise AI');
      expect(hs.dealstage).toBe('decisionmakerboughtin');
      expect(hs.amount).toBe(8500.0);
      expect(hs.contact_email).toBe('tanaka@tokyo-ai.jp');
      expect(hs.company_domain).toBe('tokyo-ai.jp');
      expect(hs.closedate).toBe('2027-11-20');
    });

    it('transforms an incoming HubSpot Deal payload into a partial Sophia deal', () => {
      const hsDeal: HubSpotDealPayload = {
        sophia_deal_id: 'deal_hs_77',
        dealname: 'Tokyo AI Studio',
        dealstage: 'closedwon',
        amount: '15000.00',
        deal_currency_code: 'USD',
        closedate: '2027-11-30T00:00:00.000Z',
        contact_email: 'tanaka.lead@tokyo-ai.jp',
        contact_phone: '+81312345678',
        company_domain: 'tokyo-ai.jp',
      };

      const sophia = transformHubSpotToSophia(hsDeal);

      expect(sophia.id).toBe('deal_hs_77');
      expect(sophia.dealStage).toBe('closed_won');
      expect(sophia.dealValueEstimateCents).toBe(1500000);
      expect(sophia.closeDate).toBe('2027-11-30');
      expect(sophia.leadEmail).toBe('tanaka.lead@tokyo-ai.jp');
      expect(sophia.leadPhone).toBe('+81312345678');
    });
  });

  describe('LWW Conflict Resolution with Sophia Authority Bias', () => {
    const baseDeal: SophiaDealSnapshot = {
      id: 'deal_authority_1',
      companyName: 'FinTech Global',
      companyDomain: 'fintech.io',
      dealStage: 'closed_won',
      dealValueEstimateCents: 10000000,
      currency: 'USD',
      leadEmail: 'cfo@fintech.io',
      leadPhone: '+12125550100',
      updatedAt: 1000,
    };

    it('REJECTS external CRM downgrade when deal is closed_won with signed contract', () => {
      const incoming: Partial<SophiaDealSnapshot> = {
        dealStage: 'demo_prepared', // Attempt to revert stage
        dealValueEstimateCents: 5000000, // Attempt to downgrade contract value
      };

      const result = resolveCrmConflict(baseDeal, incoming, {
        hasSignedContract: true,
        incomingTimestamp: 2000,
        existingTimestamp: 1000,
      });

      expect(result.action).toBe('ignore');
      expect(result.ignoredFields).toContain('dealStage');
      expect(result.ignoredFields).toContain('dealValueEstimateCents');
      expect(result.resolvedDeal.dealStage).toBe('closed_won');
      expect(result.resolvedDeal.dealValueEstimateCents).toBe(10000000);
      expect(result.reason).toContain('SOPHIA_CLOSED_WON_CONTRACT_AUTHORITY_BIAS');
    });

    it('PARTIALLY APPLIES contact updates from CRM while preserving closed_won stage authority', () => {
      const incoming: Partial<SophiaDealSnapshot> = {
        dealStage: 'proposal_sent', // Attempt to downgrade stage (must be ignored)
        leadPhone: '+12125559999', // Updated phone from CRM (should be applied)
        sdrNotes: 'Met with CFO, new direct line confirmed', // SDR notes (should be applied)
      };

      const result = resolveCrmConflict(baseDeal, incoming, {
        hasSignedContract: true,
        incomingTimestamp: 2000,
        existingTimestamp: 1000,
      });

      expect(result.action).toBe('apply');
      expect(result.ignoredFields).toContain('dealStage');
      expect(result.appliedFields).toContain('leadPhone');
      expect(result.appliedFields).toContain('sdrNotes');
      expect(result.resolvedDeal.dealStage).toBe('closed_won'); // Preserved!
      expect(result.resolvedDeal.leadPhone).toBe('+12125559999');
      expect(result.resolvedDeal.sdrNotes).toBe('Met with CFO, new direct line confirmed');
      expect(result.reason).toContain('PARTIAL_APPLY_WITH_STAGE_PROTECTION');
    });

    it('APPLIES stage advancement for non-closed deals when incoming timestamp is fresher', () => {
      const openDeal: SophiaDealSnapshot = {
        ...baseDeal,
        dealStage: 'qualified',
        updatedAt: 1000,
      };

      const incoming: Partial<SophiaDealSnapshot> = {
        dealStage: 'demo_active',
        dealValueEstimateCents: 15000000,
      };

      const result = resolveCrmConflict(openDeal, incoming, {
        hasSignedContract: false,
        incomingTimestamp: 1500,
        existingTimestamp: 1000,
      });

      expect(result.action).toBe('apply');
      expect(result.appliedFields).toContain('dealStage');
      expect(result.appliedFields).toContain('dealValueEstimateCents');
      expect(result.resolvedDeal.dealStage).toBe('demo_active');
      expect(result.resolvedDeal.dealValueEstimateCents).toBe(15000000);
    });

    it('IGNORES stale updates when incoming timestamp is older than existing record', () => {
      const openDeal: SophiaDealSnapshot = {
        ...baseDeal,
        dealStage: 'proposal_sent',
        dealValueEstimateCents: 20000000,
        updatedAt: 5000,
      };

      const incomingStale: Partial<SophiaDealSnapshot> = {
        dealValueEstimateCents: 15000000,
      };

      const result = resolveCrmConflict(openDeal, incomingStale, {
        hasSignedContract: false,
        incomingTimestamp: 4000, // Older than existing 5000
        existingTimestamp: 5000,
      });

      expect(result.action).toBe('ignore');
      expect(result.ignoredFields).toContain('dealValueEstimateCents');
      expect(result.resolvedDeal.dealValueEstimateCents).toBe(20000000);
      expect(result.reason).toContain('STALE_UPDATE_IGNORED');
    });
  });

  describe('D1 Database Persistence', () => {
    it('saves and retrieves enterprise CRM configs for a tenant', async () => {
      const saved = await saveCrmConfig(db, {
        tenantId: 'tenant_omega',
        provider: 'salesforce',
        apiEndpoint: 'https://acme.my.salesforce.com',
        clientId: 'sf_client_123',
        clientSecretEncrypted: 'enc_secret_xyz',
        syncDirection: 'bidirectional',
        isActive: true,
        fieldMapping: { StageName: 'deal_stage', Amount: 'deal_value' },
      });

      expect(saved.id).toBeDefined();
      expect(saved.tenantId).toBe('tenant_omega');
      expect(saved.provider).toBe('salesforce');
      expect(saved.apiEndpoint).toBe('https://acme.my.salesforce.com');
      expect(saved.fieldMapping.StageName).toBe('deal_stage');

      const retrieved = await getCrmConfig(db, 'tenant_omega', 'salesforce');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.clientId).toBe('sf_client_123');

      // Update via ON CONFLICT upsert
      await saveCrmConfig(db, {
        tenantId: 'tenant_omega',
        provider: 'salesforce',
        apiEndpoint: 'https://updated.salesforce.com',
      });

      const updated = await getCrmConfig(db, 'tenant_omega', 'salesforce');
      expect(updated?.apiEndpoint).toBe('https://updated.salesforce.com');
    });

    it('lists multiple CRM configs for a tenant', async () => {
      await saveCrmConfig(db, {
        tenantId: 'tenant_multi',
        provider: 'salesforce',
      });
      await saveCrmConfig(db, {
        tenantId: 'tenant_multi',
        provider: 'hubspot',
      });

      const list = await listCrmConfigs(db, 'tenant_multi');
      expect(list.length).toBe(2);
      expect(list.map((c) => c.provider).sort()).toEqual(['hubspot', 'salesforce']);
    });

    it('records and updates CRM sync events', async () => {
      const config = await saveCrmConfig(db, {
        tenantId: 'tenant_events',
        provider: 'salesforce',
      });

      const event = await recordCrmSyncEvent(db, {
        tenantId: 'tenant_events',
        crmConfigId: config.id,
        entityType: 'deal',
        entityId: 'deal_abc_1',
        direction: 'outbound',
        status: 'pending',
        payload: { dealStage: 'qualified', value: 5000 },
      });

      expect(event.id).toBeDefined();
      expect(event.status).toBe('pending');
      expect(event.entityId).toBe('deal_abc_1');

      const updated = await updateCrmSyncEvent(db, event.id, {
        status: 'synced',
        externalId: '006Dn00000123XYZ',
        syncedAt: Date.now(),
      });

      expect(updated?.status).toBe('synced');
      expect(updated?.externalId).toBe('006Dn00000123XYZ');

      const eventsList = await listCrmSyncEvents(db, 'tenant_events');
      expect(eventsList.length).toBe(1);
      expect(eventsList[0].externalId).toBe('006Dn00000123XYZ');
    });
  });
});
