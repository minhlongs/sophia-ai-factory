import { inRequest } from './request-context';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { createSqliteFixture } from './sqlite-fixture';
import { payOsCanonicalize } from '@/land/payments/payos-gateway/checksum-verifier';
import { invalidateUserTierCache } from '@/seed/db/get-user-tier';
import { clearOrgIdCache } from '@/seed/auth/org-resolver';

export const B3_ORIGIN = 'https://sophia.agencyos.network';
export const B3_PAYOS_SECRET = 'b3-synthetic-payos-checksum-key-0001';
export const B3_NOWPAYMENTS_SECRET = 'b3-synthetic-nowpayments-ipn-secret-0001';

const EXTRA_B3_MIGRATIONS = [
  '0019-raas-licenses.sql',
  '0038-user-purchases-one-time.sql',
  '0047-user-purchases-underpaid.sql',
  '0050-admin-audit-log.sql',
  '0208_refund_events_and_ledger.sql',
  '0261_commerce_tables.sql',
  '0475_nowpayments_refund_barriers.sql',
] as const;

export type B3SqliteFixture = ReturnType<typeof createSqliteFixture>;

export function createB3SqliteFixture(): B3SqliteFixture {
  const fixture = createSqliteFixture();
  for (const migration of EXTRA_B3_MIGRATIONS) {
    fixture.sqlite.exec(readFileSync(resolve('migrations', migration), 'utf8'));
  }
  fixture.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS dunning_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      license_nonce TEXT NOT NULL UNIQUE,
      grace_period_days INTEGER DEFAULT 3,
      max_retry_attempts INTEGER DEFAULT 4,
      dunning_state TEXT DEFAULT 'current',
      dunning_state_changed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  return fixture;
}

export function bindD1Globals(binding: B3SqliteFixture['binding']) {
  Object.assign(globalThis, { __env__: { DB: binding }, __D1_DB: binding });
}

export function installZeroNetworkTripwire() {
  const originalFetch = globalThis.fetch;
  const blockedFetches: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    blockedFetches.push(`${method} ${url}`);
    throw new Error(`Zero-network tripwire blocked outbound request: ${method} ${url}`);
  };
  return {
    blockedFetches,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

export function createFaultInjectingBinding(
  base: B3SqliteFixture['binding'],
  shouldFail: (sql: string) => boolean,
): B3SqliteFixture['binding'] {
  return {
    ...base,
    prepare(sql: string) {
      const stmt = base.prepare(sql);
      if (!shouldFail(sql)) return stmt;
      return {
        ...stmt,
        bind(...args: unknown[]) {
          stmt.bind(...args);
          return this;
        },
        execute() {
          throw new Error('Injected transient D1 failure');
        },
        async run() {
          throw new Error('Injected transient D1 failure');
        },
        async first() {
          throw new Error('Injected transient D1 failure');
        },
        async all() {
          throw new Error('Injected transient D1 failure');
        },
      };
    },
  };
}

export function seedSyntheticTenant(
  fixture: B3SqliteFixture,
  params: { userId: string; orgId: string; email: string },
) {
  const now = new Date().toISOString();
  fixture.sqlite
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run(params.orgId, `Synthetic Org ${params.orgId}`, now);
  fixture.sqlite
    .prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
    .run(params.orgId, params.userId, 'owner', now);
  fixture.sqlite
    .prepare(
      `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, credits_total_used, updated_at)
       VALUES (?, 50, 0, 0, ?)`,
    )
    .run(params.userId, now);
}

export function seedPendingOrder(
  fixture: B3SqliteFixture,
  params: {
    orderId: string;
    userId: string;
    tier: string;
    period?: string;
    paymentMethod: 'payos' | 'nowpayments';
    amountUsdCents: number;
    amountVnd?: number | null;
    providerPaymentId?: string | null;
    providerOrderCode?: number | null;
    status?: string;
  },
) {
  fixture.sqlite
    .prepare(
      `INSERT INTO pending_orders
       (order_id, user_id, tier, period, payment_method, amount_usd_cents, amount_vnd, provider_payment_id, provider_order_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.orderId,
      params.userId,
      params.tier,
      params.period ?? 'monthly',
      params.paymentMethod,
      params.amountUsdCents,
      params.amountVnd ?? null,
      params.providerPaymentId ?? null,
      params.providerOrderCode ?? null,
      params.status ?? 'pending',
    );
}

export function simulateWorkerRestart(userIds: string[]) {
  clearOrgIdCache();
  for (const userId of userIds) {
    invalidateUserTierCache(userId);
  }
}

export function sortObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObjectDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

export function signNowPaymentsIpn(payload: Record<string, unknown>, secret = B3_NOWPAYMENTS_SECRET): string {
  return createHmac('sha512', secret).update(JSON.stringify(sortObjectDeep(payload))).digest('hex');
}

export function signPayOsPayload(
  payloadWithoutSig: { code: string; desc: string; success: boolean; data: Record<string, unknown> },
  checksumKey = B3_PAYOS_SECRET,
): string {
  const canonical = payOsCanonicalize(JSON.stringify(payloadWithoutSig));
  return createHmac('sha256', checksumKey).update(canonical).digest('hex');
}

export function buildJsonRequest(
  path: string,
  rawBody: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`${B3_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: rawBody,
  });
}

export async function dispatchRoute<T>(
  req: NextRequest,
  handler: (request: NextRequest) => Promise<T>,
): Promise<T> {
  return inRequest(req, () => handler(req));
}
