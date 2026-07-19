'use client';

import { useParams } from 'next/navigation';
import { AlertTriangle, RefreshCw, LogIn, Wifi, Server, Home } from 'lucide-react';
import { localizedHref } from '@/seed/utils/localized-href';

type ErrorKind = 'auth' | 'network' | 'db' | 'unknown';

function classifyError(error: Error): { icon: typeof AlertTriangle; kind: ErrorKind; action: 'retry' | 'login' } {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('unauthorized') || msg.includes('auth')) return { icon: LogIn, kind: 'auth', action: 'login' };
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) return { icon: Wifi, kind: 'network', action: 'retry' };
  if (msg.includes('d1') || msg.includes('database')) return { icon: Server, kind: 'db', action: 'retry' };
  return { icon: AlertTriangle, kind: 'unknown', action: 'retry' };
}

const EN = {
  auth: 'Session expired', authDesc: 'Please sign in again.',
  network: 'Connection error', networkDesc: 'Check your connection and try again.',
  db: 'Database error', dbDesc: 'System maintenance. Try again in a moment.',
  unknown: 'Something went wrong', unknownDesc: 'An unexpected error occurred.',
  retry: 'Retry', login: 'Sign In', home: 'Dashboard',
};
const VI = {
  auth: 'Phiên đăng nhập hết hạn', authDesc: 'Vui lòng đăng nhập lại.',
  network: 'Lỗi kết nối', networkDesc: 'Kiểm tra kết nối mạng và thử lại.',
  db: 'Lỗi cơ sở dữ liệu', dbDesc: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
  unknown: 'Đã xảy ra lỗi', unknownDesc: 'Lỗi không mong muốn.',
  retry: 'Thử lại', login: 'Đăng nhập', home: 'Dashboard',
};

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'en';
  const t = locale === 'vi' ? VI : EN;
  const { icon: Icon, kind, action } = classifyError(error);

  // Dev-only: surface Next.js error.digest via a data-attribute so devs can
  // grab it from the DOM without browser-console output (avoids pulling the
  // server logger into the client bundle for a 1-line debug aid).
  const devDigest = process.env.NODE_ENV !== 'production' ? error.digest : undefined;

  const title = kind === 'auth' ? t.auth : kind === 'network' ? t.network : kind === 'db' ? t.db : t.unknown;
  const desc = kind === 'auth' ? t.authDesc : kind === 'network' ? t.networkDesc : kind === 'db' ? t.dbDesc : t.unknownDesc;

  return (
    <div
      role="alert"
      data-error-digest={devDigest}
      className="flex flex-col items-center justify-center min-h-[50vh] gap-5 px-4 text-center"
    >
      <div className="p-3 rounded-full bg-destructive/10">
        <Icon className="w-8 h-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <div className="flex gap-3">
        {action === 'login' ? (
          <a
            href={localizedHref(locale, '/login')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
          >
            <LogIn className="w-4 h-4" />
            {t.login}
          </a>
        ) : (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            {t.retry}
          </button>
        )}
        <a
          href={localizedHref(locale, '/dashboard')}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
        >
          <Home className="w-4 h-4" />
          {t.home}
        </a>
      </div>
    </div>
  );
}
