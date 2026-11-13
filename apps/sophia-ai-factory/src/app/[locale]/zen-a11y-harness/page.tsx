/**
 * Dialog accessibility harness — development only.
 *
 * Mounts the dialogs that ship in the product so Playwright can open them
 * through real user interaction (button click, Cmd+K, trigger element) instead
 * of asserting on inert markup. Returns 404 in any production build, so the
 * route cannot reach a deployed environment.
 *
 * @module app/[locale]/__zen-a11y-harness/page
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { A11yHarness } from './a11y-harness';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ZenA11yHarnessPage({ params }: Props) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  return <A11yHarness locale={locale} />;
}
