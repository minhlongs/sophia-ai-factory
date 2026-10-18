import Link from 'next/link';

export function MonitoringDetailCards({
  isVi,
  sentryOk,
  sentryDsn,
}: {
  isVi: boolean;
  sentryOk: boolean;
  sentryDsn: string;
}) {
  return (
    <>
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
    </>
  );
}
