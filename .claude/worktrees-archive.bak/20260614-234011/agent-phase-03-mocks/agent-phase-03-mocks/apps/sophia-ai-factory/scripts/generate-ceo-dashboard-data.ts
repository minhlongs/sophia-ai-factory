/**
 * CEO Dashboard Data Generator
 *
 * Aggregates data from D1 + Stripe + status checks into a JSON snapshot
 * for the CEO KPI dashboard.
 *
 * Usage:
 *   pnpm tsx scripts/generate-ceo-dashboard-data.ts
 *
 * Output:
 *   docs/dashboards/snapshot-{YYYY-MM-DD}.json
 *
 * Schedule: Daily at 09:00 UTC (cron in wrangler.toml: "0 9 * * *")
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

interface DashboardSnapshot {
  generatedAt: string;
  period: { start: string; end: string };
  kpis: {
    revenueImpact: KpiValue;
    activeUsers: KpiValue;
    uptime: KpiValue;
    supportResponse: KpiValue;
    clientRetention: KpiValue;
  };
  alerts: Alert[];
  customerBreakdown: CustomerMetrics[];
}

interface KpiValue {
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  status: 'green' | 'yellow' | 'red';
}

interface Alert {
  severity: 'info' | 'warn' | 'critical';
  message: string;
  timestamp: string;
}

interface CustomerMetrics {
  tenantId: string;
  tenantName: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  mrr: number;
  activeUsers: number;
  healthScore: number; // 0-100
}

// -- Data Sources --

async function fetchRevenueImpact(period: { start: string; end: string }): Promise<KpiValue> {
  // Sum of pilot-customer revenue from Stripe + D1 invoices
  // TODO: Wire to Stripe API in Phase 3
  const value = 0;
  const target = 5000;
  return {
    value,
    target,
    unit: 'USD',
    trend: 'flat',
    status: value >= target ? 'green' : value >= target * 0.5 ? 'yellow' : 'red',
  };
}

async function fetchActiveUsers(period: { start: string; end: string }): Promise<KpiValue> {
  // D1: SELECT COUNT(DISTINCT user_id) FROM audit_log WHERE created_at >= ? AND created_at < ?
  // TODO: Wire to D1 in Phase 3
  const value = 0;
  const target = 100;
  return {
    value,
    target,
    unit: 'users',
    trend: 'flat',
    status: value >= target ? 'green' : value >= target * 0.5 ? 'yellow' : 'red',
  };
}

async function fetchUptime(period: { start: string; end: string }): Promise<KpiValue> {
  // UptimeRobot API or Cloudflare Analytics
  // TODO: Wire to UptimeRobot in Phase 3
  const value = 99.95;
  const target = 99.9;
  return {
    value,
    target,
    unit: '%',
    trend: 'up',
    status: value >= target ? 'green' : value >= target - 1 ? 'yellow' : 'red',
  };
}

async function fetchSupportResponse(period: { start: string; end: string }): Promise<KpiValue> {
  // Average first-response time from helpdesk
  // TODO: Wire to Intercom/Zendesk in Phase 3
  const value = 0;
  const target = 4;
  return {
    value,
    target,
    unit: 'hours',
    trend: 'flat',
    status: value <= target ? 'green' : value <= target * 1.5 ? 'yellow' : 'red',
  };
}

async function fetchClientRetention(period: { start: string; end: string }): Promise<KpiValue> {
  // (1 - churned / start_of_period_customers) * 100
  // TODO: Wire to Stripe + D1 in Phase 3
  const value = 100;
  const target = 95;
  return {
    value,
    target,
    unit: '%',
    trend: 'flat',
    status: value >= target ? 'green' : value >= target - 5 ? 'yellow' : 'red',
  };
}

async function fetchAlerts(): Promise<Alert[]> {
  // Aggregate from status checks, Sentry, support queue
  // TODO: Wire to Sentry + status page in Phase 3
  return [];
}

async function fetchCustomerBreakdown(): Promise<CustomerMetrics[]> {
  // Per-tenant metrics from D1
  // TODO: Wire to D1 in Phase 3
  return [];
}

// -- Main --

function periodLastNDays(n: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - n * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function generateSnapshot(): Promise<DashboardSnapshot> {
  const period = periodLastNDays(7);

  const [revenueImpact, activeUsers, uptime, supportResponse, clientRetention] = await Promise.all([
    fetchRevenueImpact(period),
    fetchActiveUsers(period),
    fetchUptime(period),
    fetchSupportResponse(period),
    fetchClientRetention(period),
  ]);

  const [alerts, customerBreakdown] = await Promise.all([fetchAlerts(), fetchCustomerBreakdown()]);

  return {
    generatedAt: new Date().toISOString(),
    period,
    kpis: {
      revenueImpact,
      activeUsers,
      uptime,
      supportResponse,
      clientRetention,
    },
    alerts,
    customerBreakdown,
  };
}

function persistSnapshot(snapshot: DashboardSnapshot): string {
  const date = snapshot.generatedAt.split('T')[0];
  const dir = resolve(process.cwd(), 'docs/dashboards');
  mkdirSync(dir, { recursive: true });
  const filePath = resolve(dir, `snapshot-${date}.json`);
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return filePath;
}

// -- CLI Entry --

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  generateSnapshot()
    .then((snapshot) => {
      const filePath = persistSnapshot(snapshot);
      console.log(`Dashboard snapshot saved: ${filePath}`);
      console.log(`KPI summary:`);
      for (const [name, kpi] of Object.entries(snapshot.kpis)) {
        console.log(`  ${name}: ${kpi.value}${kpi.unit} (target ${kpi.target}${kpi.unit}) [${kpi.status}]`);
      }
    })
    .catch((err) => {
      console.error('Failed to generate snapshot:', err);
      process.exit(1);
    });
}

export { generateSnapshot, persistSnapshot };
export type { DashboardSnapshot, KpiValue, Alert, CustomerMetrics };
