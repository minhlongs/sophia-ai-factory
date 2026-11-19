// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(), finish: vi.fn(), fail: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: () => ({}), finishCronCheckIn: mocks.finish, failCronCheckIn: mocks.fail,
}));
import { GET } from './route';

type SqlValue = string | number | null;

function fixture() {
  const sqlite = new DatabaseSync(':memory:') as DatabaseSync & { close(): void };
  sqlite.exec('CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT, created_at TEXT);');
  for (const migration of ['0100-onboarding-automation.sql', '0026-cron-run-log.sql']) {
    sqlite.exec(readFileSync(resolve('migrations', migration), 'utf8'));
  }
  // D1's numbered slots are positional; node:sqlite treats them as named slots.
  function prepare(sql: string) {
    const normalized = sql.replace(/\?\d+/g, '?');
    let values: SqlValue[] = [];
    return {
      bind(...args: SqlValue[]) { values = args; return this; },
      async run() {
        const result = sqlite.prepare(normalized).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
      async all<T>() { return { results: sqlite.prepare(normalized).all(...values) as T[] }; },
      async first<T>() { return (sqlite.prepare(normalized).get(...values) ?? null) as T | null; },
    };
  }
  const seedTenant = (id: string) => sqlite.prepare(
    `INSERT INTO tenants (id, name, created_at, onboarding_status)
     VALUES (?, ?, datetime('now', '-11 days'), 'in_progress')`,
  ).run(id, id);
  return { sqlite, db: { prepare }, seedTenant };
}

const request = () => new NextRequest('http://localhost/api/cron/onboarding-check', {
  headers: { authorization: 'Bearer synthetic-onboarding-test-secret' },
});

describe('onboarding alert persistence against SQLite', () => {
  let state: ReturnType<typeof fixture>;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'synthetic-onboarding-test-secret');
    state = fixture();
    mocks.getD1.mockResolvedValue(state.db);
  });
  afterEach(() => { state.sqlite.close(); vi.unstubAllEnvs(); });

  it('persists an alert and skips a repeat invocation without duplicating it', async () => {
    state.seedTenant('at-risk-tenant');
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, checked: 1, atRisk: 1, alertsLogged: 1, errors: [] });
    expect(state.sqlite.prepare('SELECT tenant_id, flags, detected_at, resolved FROM onboarding_alerts').all()).toEqual([
      { tenant_id: 'at-risk-tenant', flags: 'kickoff_missed,discovery_overdue,channels_not_connected,first_post_missed', detected_at: expect.any(String), resolved: 0 },
    ]);
    expect(state.sqlite.prepare('SELECT onboarding_status FROM tenants').get()).toEqual({ onboarding_status: 'at_risk' });
    expect(state.sqlite.prepare('SELECT last_status, run_count FROM cron_run_log').get()).toEqual({ last_status: 'success', run_count: 1 });
    const repeated = await GET(request());
    expect(await repeated.json()).toEqual({ ok: true, skipped: 'recent_run' });
    expect(state.sqlite.prepare('SELECT COUNT(*) AS count FROM onboarding_alerts').get()).toEqual({ count: 1 });
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it('reports an insert rejection as failure while persisting alerts for other tenants', async () => {
    state.seedTenant('rejected-tenant');
    state.seedTenant('healthy-tenant');
    state.sqlite.exec(`CREATE TRIGGER reject_alert BEFORE INSERT ON onboarding_alerts
      WHEN NEW.tenant_id = 'rejected-tenant'
      BEGIN SELECT RAISE(ABORT, 'synthetic alert insert rejected'); END;`);
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false, checked: 2, atRisk: 2, alertsLogged: 1,
      errors: ['rejected-tenant: synthetic alert insert rejected'],
    });
    expect(state.sqlite.prepare('SELECT tenant_id FROM onboarding_alerts').all()).toEqual([{ tenant_id: 'healthy-tenant' }]);
    expect(state.sqlite.prepare('SELECT last_status, run_count FROM cron_run_log').get()).toEqual({ last_status: 'failure', run_count: 1 });
    expect(mocks.fail).toHaveBeenCalledWith(expect.anything(), 'onboarding-check', 'rejected-tenant: synthetic alert insert rejected');
    expect(mocks.finish).not.toHaveBeenCalled();
  });
});
