/**
 * Customize Settings page — server component shell.
 * Loads auth/session server-side; delegates rendering to client component.
 * @module app/[locale]/dashboard/settings/customize/page
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { CustomizePageClient } from './customize-page-client';

export const metadata: Metadata = {
  title: 'Customize — Sophia AI Factory',
  description: 'Configure branding, scoring, geo rules, cron schedules, channels and more.',
};

export default async function CustomizeSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Customize</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage per-tenant settings — branding, scoring weights, geo rules, cron schedules, and more.
        </p>
      </div>
      <CustomizePageClient />
    </div>
  );
}
