import { redirect } from 'next/navigation';

/**
 * /[locale]/setup-wizard — DEPRECATED. Permanently redirects to canonical URL.
 *
 * Canonical onboarding URL is /dashboard/onboarding (see plan
 * 260519-0300-handover-funnel-critical-fixes/phase-02-setup-wizard-locale-routing.md).
 * All marketing CTAs, welcome flows, and internal links should point to
 * /dashboard/onboarding. This redirect exists for backward-compat with
 * bookmarks, emails, and external links.
 *
 * Search params are forwarded so any deep-link query (e.g. ?step=2) survives.
 *
 * @module app/[locale]/setup-wizard/page
 */
export default async function SetupWizardRedirect({
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') query.set(k, v);
    else if (Array.isArray(v) && v.length > 0) query.set(k, v[0]);
  }
  const qs = query.size > 0 ? `?${query.toString()}` : '';
  redirect(`/dashboard/onboarding${qs}`);
}
