/**
 * Workspace external-affiliate results dashboard.
 *
 * Distinguishes unauthenticated / unconnected / empty / loading-error / ready.
 * An error is never rendered as $0.00, a failed kill-switch read is never
 * rendered as "off", and a multi-currency ledger is never summed into one USD
 * figure. A video or click count that could not be read is rendered as
 * unavailable, never as 0. External affiliate earnings (Domain B) are separate
 * from subscription billing, Refer Sophia and partner payouts.
 *
 * Layer: app/[locale]/dashboard/affiliates (Presentation)
 */

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { createServerClient } from '@/seed/db/client';
import { getAffiliateKillSwitchState, type KillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  AffiliateCockpitView,
  generateExecutiveCockpitSnapshot,
  mapDomainBToReconciliationSummary,
} from '@/land/affiliates/dashboard';
import {
  DASHBOARD_STATE_COPY,
  effectiveCommissionByCurrency,
  resolveDashboardViewState,
  type DashboardViewState,
} from '@/land/affiliates/dashboard/dashboard-load-state';
import {
  fetchWorkspaceDomainBReconciliation,
  type DomainBReconciliationSummary,
} from '@/land/affiliates/reconciliation/workspace-domain-b-reconciliation';
import {
  EMPTY_RECONCILIATION,
  AffiliateHookRankingTable,
  type AffiliateMetrics,
} from './affiliates-dashboard-sections';
import {
  AFFILIATE_METRICS_UNAVAILABLE,
  loadWorkspaceAffiliateMetrics,
  type WorkspaceAffiliateMetrics,
} from '@/land/affiliates/affiliate-live-metrics';

export interface AffiliateDashboardData {
  tenantId: string;
  domainBSummary?: DomainBReconciliationSummary;
  metrics: AffiliateMetrics;
  /** Which production figures could actually be read, so the UI never shows a zero it invented. */
  metricAvailability: WorkspaceAffiliateMetrics['availability'];
  killSwitch: KillSwitchState;
  view: DashboardViewState;
}

export async function loadWorkspaceAffiliateDashboardData(): Promise<AffiliateDashboardData> {
  let tenantId = 'unauthenticated';
  const killSwitch: KillSwitchState = { active: true, known: false, reason: 'NOT_READ' };
  let authenticated = false;
  let dbAvailable = false;
  let queryOk = false;
  let summary: DomainBReconciliationSummary | undefined;
  let workspaceMetrics = AFFILIATE_METRICS_UNAVAILABLE;

  try {
    const user = await getCurrentUser();
    if (user?.id) {
      authenticated = true;
      tenantId = user.id;
      try {
        const db = createServerClient();
        const orgId = await resolveOrgId(user.id, db);
        tenantId = orgId ?? user.id;

        const rawD1: D1Database | null =
          typeof (db as { unwrap?: () => D1Database }).unwrap === 'function'
            ? (db as { unwrap: () => D1Database }).unwrap()
            : typeof (db as { prepare?: unknown }).prepare === 'function'
              ? (db as unknown as D1Database)
              : null;

        dbAvailable = rawD1 !== null;
        if (rawD1) {
          // Video and bridge-click counts are keyed by user id: campaigns and
          // affiliate_partners both carry user_id and no tenant column.
          workspaceMetrics = await loadWorkspaceAffiliateMetrics(rawD1, user.id);
          const domainBRes = await fetchWorkspaceDomainBReconciliation(rawD1, tenantId);
          queryOk = domainBRes.ok;
          if (domainBRes.ok) summary = domainBRes.value;
        }
        const state = await getAffiliateKillSwitchState(tenantId);
        killSwitch.active = state.active;
        killSwitch.known = state.known;
        killSwitch.reason = state.reason;
      } catch (err) {
        dbAvailable = false;
        queryOk = false;
        killSwitch.known = false;
        killSwitch.reason = err instanceof Error ? err.message : String(err);
      }
    }
  } catch {
    authenticated = false;
  }

  const view = resolveDashboardViewState({
    authenticated,
    dbAvailable,
    queryOk,
    killSwitchKnown: killSwitch.known,
    summary,
  });

  // Only a single-currency, successfully loaded ledger yields a headline value.
  const totalCommissionUsd =
    view.state === 'ready' && view.financialsAvailable && summary?.isSingleCurrency
      ? summary.effectiveCommissionCents / 100
      : 0;

  return {
    tenantId,
    domainBSummary: summary,
    metrics: { ...workspaceMetrics.metrics, totalCommissionUsd },
    metricAvailability: workspaceMetrics.availability,
    killSwitch,
    view,
  };
}

export default async function AffiliatesDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await props.params;
  const locale = rawLocale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';
  const { tenantId, domainBSummary, metrics, metricAvailability, killSwitch, view } =
    await loadWorkspaceAffiliateDashboardData();

  const reconciliation = domainBSummary
    ? mapDomainBToReconciliationSummary(domainBSummary)
    : { ...EMPTY_RECONCILIATION, tenantId };

  const cockpitSnapshot = generateExecutiveCockpitSnapshot({
    tenantId,
    reconciliation,
    scalingDecisions: [],
    // A failed read fails closed AND is shown as unknown, never as "off".
    killSwitchActive: killSwitch.active || !killSwitch.known,
    domainBSummary,
  });

  const stateCopy = DASHBOARD_STATE_COPY[view.state][locale];
  const perCurrency = domainBSummary ? effectiveCommissionByCurrency(domainBSummary) : [];

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {isVi ? 'Kết Quả Affiliate' : 'Affiliate Results'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isVi
            ? 'Chỉ số liệu hoa hồng affiliate bên ngoài của workspace — tách biệt với thanh toán gói dịch vụ và Refer Sophia.'
            : 'External affiliate commission only — separate from subscription billing and Refer Sophia.'}
        </p>
      </div>

      {/* Explicit connection / safety state, never a silent zero. */}
      <div
        role="status"
        data-testid="affiliate-load-state"
        data-state={view.state}
        className={
          view.state === 'error' || !killSwitch.known
            ? 'rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300'
            : 'rounded-lg border bg-card p-4 text-sm text-muted-foreground'
        }
      >
        <p className="font-semibold">{stateCopy}</p>
        {!killSwitch.known && view.state !== 'unauthenticated' ? (
          <p className="mt-1 text-xs">
            {isVi
              ? 'Trạng thái công tắc dừng khẩn cấp chưa xác minh — các tác vụ chi tiêu bị tạm dừng.'
              : 'Emergency halt state is unknown — spending actions are paused (fail-closed).'}
          </p>
        ) : null}
      </div>

      <AffiliateCockpitView snapshot={cockpitSnapshot} locale={locale} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            {isVi ? 'Hoa Hồng Hiệu Lực' : 'Effective Commission'}
          </p>
          {view.state === 'ready' && view.financialsAvailable ? (
            <h3 className="text-3xl font-bold mt-2 text-primary">
              ${metrics.totalCommissionUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {view.currencies[0] ?? 'USD'}
              </span>
            </h3>
          ) : view.state === 'ready' ? (
            // Multi-currency: no FX rate source exists, so show each currency.
            <ul className="mt-2 space-y-1">
              {perCurrency.map((entry) => (
                <li key={entry.currency} className="text-lg font-semibold text-primary">
                  {entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {entry.currency}
                </li>
              ))}
            </ul>
          ) : (
            <h3 className="text-xl font-semibold mt-2 text-muted-foreground" data-testid="earnings-unavailable">
              {isVi ? 'Không có số liệu' : 'Not available'}
            </h3>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {isVi ? 'Chờ duyệt / đã duyệt / đã trả / đã đảo chiều' : 'Pending / approved / paid / reversed'}
          </p>
        </div>

        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            {isVi ? 'Lượt Click Qua Bridge Page' : 'Bridge Page Clicks'}
          </p>
          {metricAvailability.totalBridgeClicks ? (
            <h3 className="text-3xl font-bold mt-2" data-testid="bridge-clicks-count">
              {metrics.totalBridgeClicks.toLocaleString()}
            </h3>
          ) : (
            <h3 className="text-xl font-semibold mt-2 text-muted-foreground" data-testid="bridge-clicks-unavailable">
              {isVi ? 'Không có số liệu' : 'Not available'}
            </h3>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {metricAvailability.totalBridgeClicks
              ? (isVi ? 'Dữ liệu workspace' : 'Workspace data')
              : (isVi ? 'Chưa đọc được số liệu' : 'Could not be read')}
          </p>
        </div>

        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            {isVi ? 'Trạng Thái Sản Xuất' : 'Production State'}
          </p>
          <h3 className="text-xl font-semibold mt-2">
            {metricAvailability.totalVideosGenerated ? metrics.totalVideosGenerated : '—'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isVi
              ? 'Số video đã tạo. Queue chưa phải là media đã render'
              : 'Videos produced. A queued job is not rendered media'}
          </p>
        </div>
      </div>

      <AffiliateHookRankingTable locale={locale} />
    </div>
  );
}
