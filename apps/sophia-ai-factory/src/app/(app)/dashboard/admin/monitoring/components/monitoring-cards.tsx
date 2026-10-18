import { StatusPill } from './status-pill';
import { MonitoringDetailCards } from './monitoring-detail-cards';

interface MonitoringCardsProps {
  isVi: boolean;
  sentryOk: boolean;
  sentryDsn: string;
  honeycombKeyOk: boolean;
  honeycombDataset: string;
  sampleRate: string;
}

export function MonitoringCards({
  isVi,
  sentryOk,
  sentryDsn,
  honeycombKeyOk,
  honeycombDataset,
  sampleRate,
}: MonitoringCardsProps) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sentry Status Card */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between p-6 pb-3">
            <h2 className="text-lg font-semibold">Sentry</h2>
            <StatusPill ok={sentryOk} />
          </div>
          <div className="px-6 pb-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isVi ? 'DSN' : 'DSN'}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono max-w-[200px] truncate">
                {sentryOk
                  ? `${sentryDsn.slice(0, 20)}...`
                  : isVi
                    ? 'Chưa cấu hình'
                    : 'Not set'}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isVi ? 'Môi trường' : 'Environment'}</span>
              <span className="font-medium">{process.env.NODE_ENV ?? 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isVi ? 'Traces Sample Rate' : 'Traces Sample Rate'}</span>
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
              <span className="text-muted-foreground">{isVi ? 'Dataset' : 'Dataset'}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {honeycombDataset}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isVi ? 'Sampling Rate' : 'Sampling Rate'}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {sampleRate}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isVi ? 'API Key' : 'API Key'}</span>
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
              <span className="text-muted-foreground">{isVi ? 'Dịch vụ' : 'Service'}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {process.env.OTEL_SERVICE_NAME || 'sophia-api'}
              </code>
            </div>
          </div>
        </div>
      </div>

      <MonitoringDetailCards
        isVi={isVi}
        sentryOk={sentryOk}
        sentryDsn={sentryDsn}
      />
    </>
  );
}
