/**
 * /dashboard/admin/funnel — Activation funnel for admins.
 *
 * Server Component. Renders 3 cohort windows (last 30/60/90 days)
 * fetched in parallel. Each shows step counts + step-to-step conversion %.
 */

import { redirect } from 'next/navigation';
import { Activity } from 'lucide-react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getActivationFunnel,
  type ActivationFunnel,
} from '@/land/analytics/funnel-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const DAY_SEC = 86400;

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export default async function FunnelPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`);

  const now = Math.floor(Date.now() / 1000);
  const [d30, d60, d90] = await Promise.all([
    getActivationFunnel(now - 30 * DAY_SEC, now),
    getActivationFunnel(now - 60 * DAY_SEC, now),
    getActivationFunnel(now - 90 * DAY_SEC, now),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Activity className="w-6 h-6 text-violet-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Activation Funnel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cohort breakdown by signup window. Step counts include only users
            who entered the cohort during the window — later actions count even
            if they happened after.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FunnelCard label="Last 30 days" funnel={d30} />
        <FunnelCard label="Last 60 days" funnel={d60} />
        <FunnelCard label="Last 90 days" funnel={d90} />
      </div>
    </div>
  );
}

function FunnelCard({
  label,
  funnel,
}: {
  label: string;
  funnel: ActivationFunnel;
}): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
        {label}
      </h2>

      <ol className="space-y-3 text-sm">
        <FunnelStep label="Signups" value={funnel.signups} />
        <FunnelStep
          label="First login"
          value={funnel.firstLogin}
          ratio={pct(funnel.conversions.signupToLogin)}
        />
        <FunnelStep
          label="First video"
          value={funnel.firstVideo}
          ratio={pct(funnel.conversions.loginToVideo)}
        />
        <FunnelStep
          label="First conversion"
          value={funnel.firstConversion}
          ratio={pct(funnel.conversions.videoToConversion)}
        />
      </ol>
    </article>
  );
}

function FunnelStep({
  label,
  value,
  ratio,
}: {
  label: string;
  value: number;
  ratio?: string;
}): React.JSX.Element {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2 font-mono">
        <span className="text-lg font-semibold">{value.toLocaleString()}</span>
        {ratio && (
          <span className="text-[11px] text-muted-foreground" aria-label={`conversion ${ratio}`}>
            ({ratio})
          </span>
        )}
      </span>
    </li>
  );
}
