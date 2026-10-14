import {
  getSentryDsn,
  getHoneycombDataset,
  getOtelSampleRate,
  hasHoneycombApiKey,
  hasSentryDsn,
} from './monitoring-env';
import { MonitoringCards } from './monitoring-cards';

export function MonitoringDashboardView({ locale }: { locale: string }): React.JSX.Element {
  const isVi = locale.startsWith('vi');
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

      <MonitoringCards
        isVi={isVi}
        sentryOk={hasSentryDsn()}
        sentryDsn={getSentryDsn()}
        honeycombKeyOk={hasHoneycombApiKey()}
        honeycombDataset={getHoneycombDataset()}
        sampleRate={getOtelSampleRate()}
      />
    </main>
  );
}
