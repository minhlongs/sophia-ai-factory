/**
 * Stateful in-memory D1 mock helper for OPC Gate 1 Pre-Flight & Self-Serve tests.
 *
 * Simulates `publishing_channels` and `affiliate_offers` tables so self-serve
 * actions (`registerPublishingChannel`, `saveNicheWorkspaceOfferAction`,
 * `getOpcGate1ReadinessAction`) can be tested deterministically with 0 network calls.
 *
 * @module forest/actions/__tests__/opc-gate1-mock-d1-helper
 */

export interface MockChannelRow {
  id: string;
  tenant_id: string;
  user_id: string;
  provider: string;
  external_account_id: string;
  access_token: string;
  status: string;
  created_at: number;
}

export interface MockOfferRow {
  id: string;
  tenant_id: string;
  network_id: string;
  external_id: string;
  product_url: string;
  destination_url: string;
  status: string;
  commission_terms: string;
  niche: string;
  region: string;
  category: string;
}

function queryFirstMockRow<T>(
  sql: string,
  args: unknown[],
  channelStore: Map<string, MockChannelRow>,
  offerStore: Map<string, MockOfferRow>,
): T | null {
  if (sql.includes('FROM publishing_channels') && sql.includes('external_account_id')) {
    const [tenantId, provider, extId] = args as [string, string, string];
    const match = Array.from(channelStore.values()).find(
      (r) => r.tenant_id === tenantId && r.provider === provider && r.external_account_id === extId,
    );
    return (match ? { id: match.id } : null) as unknown as T | null;
  }
  if (sql.includes('FROM publishing_channels') && sql.includes('ORDER BY created_at DESC')) {
    const [tenantId] = args as [string];
    const match = Array.from(channelStore.values()).find(
      (r) => r.tenant_id === tenantId && r.provider === 'youtube' && r.status === 'active',
    );
    return (match ? { id: match.id, access_token: match.access_token } : null) as unknown as T | null;
  }
  if (sql.includes('SELECT tenant_id FROM affiliate_offers WHERE id = ?')) {
    const [offerId] = args as [string];
    const found = offerStore.get(offerId);
    return (found ? { tenant_id: found.tenant_id } : null) as unknown as T | null;
  }
  return null;
}

function mutateMockRow(
  sql: string,
  args: unknown[],
  channelStore: Map<string, MockChannelRow>,
  offerStore: Map<string, MockOfferRow>,
): void {
  if (sql.includes('INSERT INTO publishing_channels')) {
    const [id, tenantId, provider, extId, , accessToken, , , nowSec, userId] = args as [
      string,
      string,
      string,
      string,
      string | null,
      string,
      string | null,
      number | null,
      number,
      string,
    ];
    channelStore.set(id, {
      id,
      tenant_id: tenantId,
      user_id: userId,
      provider,
      external_account_id: extId,
      access_token: accessToken,
      status: 'active',
      created_at: nowSec,
    });
  }
  if (sql.includes('INSERT INTO affiliate_offers')) {
    const [
      id,
      tenantId,
      networkId,
      externalId,
      ,
      ,
      category,
      productUrl,
      destinationUrl,
      commissionTerms,
      niche,
      region,
    ] = args as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    offerStore.set(id, {
      id,
      tenant_id: tenantId,
      network_id: networkId,
      external_id: externalId,
      product_url: productUrl,
      destination_url: destinationUrl,
      status: 'active',
      commission_terms: commissionTerms,
      niche,
      region,
      category,
    });
  }
}

export function createOpcGate1StatefulMockD1(
  channelStore: Map<string, MockChannelRow>,
  offerStore: Map<string, MockOfferRow>,
): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              return queryFirstMockRow<T>(sql, args, channelStore, offerStore);
            },
            async all<T>() {
              if (sql.includes('FROM affiliate_offers')) {
                const [workspaceId] = args as [string];
                const results = Array.from(offerStore.values()).filter(
                  (r) =>
                    (r.tenant_id === workspaceId || r.tenant_id === 'system') && r.status === 'active',
                );
                return { results: results as unknown as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              mutateMockRow(sql, args, channelStore, offerStore);
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}
