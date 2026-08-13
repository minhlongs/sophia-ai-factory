// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/monitoring — Observability config status (admin only).
 *
 * Shows Sentry and OpenTelemetry configuration health at a glance.
 * Server Component — reads env vars directly, no API calls needed.
 *
 * @module app/[locale]/dashboard/admin/monitoring/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import Link from 'next/link';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Monitoring | Admin | Sophia AI',
};

function getSentryDsn(): string {
  return process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
}

function getHoneycombDataset(): string {
  return process.env.HONEYCOMB_DATASET || 'sophia-prod';
}

function getOtelSampleRate(): string {
  return process.env.OTEL_SAMPLERATE || '0.01';
}

function hasHoneycombApiKey(): boolean {
  return !!(process.env.HONEYCOMB_API_KEY ?? '');
}

function hasSentryDsn(): boolean {
  return getSentryDsn().length > 0;
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      }`}
    >
      {ok ? 'Configured' : 'Not Configured'}
    </span>
  );
}

export default async function MonitoringPage({
  params,
}: Props): Promise<React.JSX.Element> {
  const { locale } = await params;
  await requireMasterTier();

  const isVi = locale.startsWith('vi');
  const sentryDsn = getSentryDsn();
  const sentryOk = hasSentryDsn();
  const honeycombDataset = getHoneycombDataset();
  const sampleRate = getOtelSampleRate();
  const honeycombKeyOk = hasHoneycombApiKey();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-muted-foreground-100">
          {isVi ? 'Giám Sát Hệ Thống' : 'System Monitoring'}
        </h1>
        <p className="text-sm text-muted-foreground-400 mt-1">
          {isVi
            ? 'Trạng thái cấu hình Sentry và OpenTelemetry'
            : 'Sentry and OpenTelemetry configuration status'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sentry Status Card */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between p-6 pb-3">
            <h2 className="text-lg font-semibold">Sentry</h2>
            <StatusPill ok={sentryOk} />
          </div>
          <div className="px-6 pb-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'DSN' : 'DSN'}
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono max-w-[200px] truncate">
                {sentryOk
                  ? `${sentryDsn.slice(0, 20)}...`
                  : isVi
                    ? 'Chưa cấu hình'
                    : 'Not set'}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'Môi trường' : 'Environment'}
              </span>
              <span className="font-medium">
                {process.env.NODE_ENV ?? 'unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'Traces Sample Rate' : 'Traces Sample Rate'}
              </span>
              <span className="font-medium">
                {process.env.NODE_ENV === 'production' ? '0.05 (5%)' : '1.0 (100%)'}
              </span>
            </div>
          </div>
        </div>

        {/* OTEL / Honeycomb Status Card */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between p-6 pb-3">
            <h2 className="text-lg font-semibold">OpenTelemetry (Honeycomb)</h2>
            <StatusPill ok={honeycombKeyOk} />
          </div>
          <div className="px-6 pb-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'Dataset' : 'Dataset'}
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {honeycombDataset}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'Sampling Rate' : 'Sampling Rate'}
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {sampleRate}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'API Key' : 'API Key'}
              </span>
              <span className="font-medium">
                {honeycombKeyOk
                  ? isVi
                    ? 'Đã cấu hình'
                    : 'Configured'
                  : isVi
                    ? 'Chưa cấu hình'
                    : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'Dịch vụ' : 'Service'}
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {process.env.OTEL_SERVICE_NAME || 'sophia-api'}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Health endpoint link */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-2">
          {isVi ? 'API Health Check' : 'API Health Check'}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          {isVi
            ? 'Kiểm tra trạng thái hoạt động của server.'
            : 'Verify the runtime is alive and responding.'}
        </p>
        <Link
          href="/api/health"
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {isVi ? 'Mở /api/health' : 'Open /api/health'}
        </Link>
      </div>

      {/* Sentry DSN detail (only when configured) */}
      {sentryOk && (
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-2">
            {isVi ? 'Chi Tiết Sentry' : 'Sentry Details'}
          </h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isVi ? 'DSN (rút gọn)' : 'DSN (truncated)'}
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono max-w-[300px] truncate">
                {sentryDsn}
              </code>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">
                {isVi ? 'Release' : 'Release'}
              </span>
              <span className="font-medium">
                {process.env.COMMIT_SHA || process.env.SENTRY_RELEASE || 'local'}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}