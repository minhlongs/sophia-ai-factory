/**
 * Enterprise CRM & Webhook Bus End-to-End Integration Test Suite
 *
 * Verifies the complete lifecycle across Pillar R2:
 * 1. Multi-provider CRM setup (Salesforce & HubSpot).
 * 2. Deal state progression and bidirectional payload transformations.
 * 3. Authority bias enforcement on closed enterprise contracts.
 * 4. Webhook event publication, HMAC-SHA256 signature verification, and delivery logging.
 *
 * @vitest-environment node
 * @module tree/integrations/__tests__/integration-end-to-end.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import type { SophiaDealSnapshot } from '../types';
import {
  saveCrmConfig,
  getCrmConfig,
  recordCrmSyncEvent,
  updateCrmSyncEvent,
  listCrmSyncEvents,
  transformSophiaToSalesforce,
  transformSalesforceToSophia,
  transformSophiaToHubSpot,
  transformHubSpotToSophia,
  resolveCrmConflict,
} from '../crm-sync-engine';
import {
  createWebhookSubscription,
  dispatchWebhookEvent,
  verifyWebhookSignature,
  listWebhookDeliveryLogs,
} from '../webhook-dispatcher';

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

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      event_types TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_delivery_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      signature TEXT NOT NULL,
      http_status INTEGER,
      response_body TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'retrying')),
      attempt_number INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id)
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

describe('Enterprise CRM & Webhook Bus End-to-End Flow', () => {
  let db: D1Database;
  const tenantId = 'tenant_enterprise_apac';

  beforeEach(() => {
    db = createMockD1();
  });

  it('runs complete lifecycle: config -> sync outbound -> CRM inbound -> conflict resolution -> webhook dispatch', async () => {
    // 1. Configure Salesforce and HubSpot
    const sfConfig = await saveCrmConfig(db, {
      tenantId,
      provider: 'salesforce',
      apiEndpoint: 'https://apac.my.salesforce.com',
      clientId: 'sf_client_apac',
      syncDirection: 'bidirectional',
    });

    const hsConfig = await saveCrmConfig(db, {
      tenantId,
      provider: 'hubspot',
      apiEndpoint: 'https://api.hubspot.com',
      clientId: 'hs_client_apac',
      syncDirection: 'bidirectional',
    });

    expect(sfConfig.provider).toBe('salesforce');
    expect(hsConfig.provider).toBe('hubspot');

    // 2. Initial Sophia Deal
    const deal: SophiaDealSnapshot = {
      id: 'deal_apac_001',
      companyName: 'Saigon Tech Hub',
      companyDomain: 'saigontech.vn',
      dealStage: 'qualified',
      dealValueEstimateCents: 2500000, // $25,000.00
      currency: 'USD',
      leadEmail: 'founder@saigontech.vn',
      leadPhone: '+84988776655',
      updatedAt: 1000,
    };

    // 3. Outbound sync to Salesforce Opportunity
    const sfPayload = transformSophiaToSalesforce(deal);
    expect(sfPayload.StageName).toBe('Qualification');
    expect(sfPayload.Amount).toBe(25000.0);

    const sfEvent = await recordCrmSyncEvent(db, {
      tenantId,
      crmConfigId: sfConfig.id,
      entityType: 'deal',
      entityId: deal.id,
      direction: 'outbound',
      status: 'pending',
      payload: sfPayload as unknown as Record<string, unknown>,
    });
    expect(sfEvent.id).toBeDefined();

    // Mark synced with external ID
    await updateCrmSyncEvent(db, sfEvent.id, {
      status: 'synced',
      externalId: '006_SF_OPP_001',
      syncedAt: Date.now(),
    });

    // 4. Inbound update from HubSpot advancing deal to closed_won
    const hsInboundPayload = {
      sophia_deal_id: deal.id,
      dealname: 'Saigon Tech Hub - Enterprise AI',
      dealstage: 'closedwon',
      amount: '30000.00',
      deal_currency_code: 'USD',
      contact_email: 'founder.direct@saigontech.vn',
      contact_phone: '+84988776655',
      company_domain: 'saigontech.vn',
    };

    const parsedHubSpot = transformHubSpotToSophia(hsInboundPayload);
    expect(parsedHubSpot.dealStage).toBe('closed_won');
    expect(parsedHubSpot.dealValueEstimateCents).toBe(3000000);

    const resolution1 = resolveCrmConflict(deal, parsedHubSpot, {
      hasSignedContract: false,
      incomingTimestamp: 2000,
      existingTimestamp: 1000,
    });

    expect(resolution1.action).toBe('apply');
    expect(resolution1.resolvedDeal.dealStage).toBe('closed_won');
    expect(resolution1.resolvedDeal.dealValueEstimateCents).toBe(3000000);
    expect(resolution1.resolvedDeal.leadEmail).toBe('founder.direct@saigontech.vn');

    // 5. Sophia Contract is signed!
    const closedDealWithContract: SophiaDealSnapshot = {
      ...resolution1.resolvedDeal,
      dealStage: 'closed_won',
      updatedAt: 3000,
    };

    // 6. External CRM (e.g. rogue SDR or stale webhook) tries to revert deal to 'Prospecting'
    const rogueIncoming: Partial<SophiaDealSnapshot> = {
      dealStage: 'new_lead',
      dealValueEstimateCents: 1000000,
      leadPhone: '+84900112233', // Legitimate phone update
    };

    const resolution2 = resolveCrmConflict(closedDealWithContract, rogueIncoming, {
      hasSignedContract: true, // PROTECTED!
      incomingTimestamp: 4000,
      existingTimestamp: 3000,
    });

    // Stage downgrade was rejected, phone update applied
    expect(resolution2.action).toBe('apply');
    expect(resolution2.ignoredFields).toContain('dealStage');
    expect(resolution2.ignoredFields).toContain('dealValueEstimateCents');
    expect(resolution2.appliedFields).toContain('leadPhone');
    expect(resolution2.resolvedDeal.dealStage).toBe('closed_won');
    expect(resolution2.resolvedDeal.dealValueEstimateCents).toBe(3000000);
    expect(resolution2.resolvedDeal.leadPhone).toBe('+84900112233');

    // 7. Subscribe customer webhook to 'deal.won' events
    const secretKey = 'whsec_enterprise_key_99999';
    const sub = await createWebhookSubscription(db, {
      tenantId,
      endpointUrl: 'https://erp.saigontech.vn/api/webhooks',
      secretKey,
      eventTypes: ['deal.won'],
      description: 'SAP ERP Integration',
    });

    // 8. Dispatch 'deal.won' webhook
    let receivedHeader = '';
    let receivedBody = '';

    const mockFetch = vi.fn().mockImplementation(async (url, init) => {
      receivedHeader = init.headers['X-Sophia-Signature-256'];
      receivedBody = init.body;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'ACK' }),
      };
    });

    const nowSec = 1758855000;
    const dispatchResult = await dispatchWebhookEvent(
      db,
      sub,
      'deal.won',
      {
        dealId: closedDealWithContract.id,
        stage: 'closed_won',
        contractValueCents: closedDealWithContract.dealValueEstimateCents,
        currency: closedDealWithContract.currency,
        company: closedDealWithContract.companyName,
      },
      { fetcher: mockFetch as unknown as typeof fetch, currentTimeSeconds: nowSec }
    );

    expect(dispatchResult.status).toBe('success');
    expect(dispatchResult.httpStatus).toBe(200);

    // 9. Customer verifies received webhook signature
    const verifyResult = await verifyWebhookSignature(
      secretKey,
      receivedBody,
      receivedHeader,
      { currentTimestampSeconds: nowSec + 10 }
    );
    expect(verifyResult.valid).toBe(true);

    // 10. Verify audit delivery log
    const logs = await listWebhookDeliveryLogs(db, sub.id);
    expect(logs.length).toBe(1);
    expect(logs[0].eventType).toBe('deal.won');
    expect(logs[0].status).toBe('success');

    // Verify sync events list
    const syncEvents = await listCrmSyncEvents(db, tenantId);
    expect(syncEvents.length).toBe(1);
    expect(syncEvents[0].status).toBe('synced');
  });
});
