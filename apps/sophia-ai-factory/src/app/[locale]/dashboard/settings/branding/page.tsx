/**
 * /dashboard/settings/branding — Per-tenant branding customization.
 * Loads current branding from tenant-settings registry and renders client form.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/settings/branding/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { BrandingFormClient } from './branding-form-client';
import type { BrandingSettings } from '@/lib/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/lib/tenant-settings/defaults';

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata = { title: 'Brand Settings | Sophia AI' };

async function loadBranding(userId: string): Promise<BrandingSettings> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/v1/settings/branding`,
      {
        headers: { 'x-internal-user-id': userId },
        cache: 'no-store',
      },
    );
    if (!res.ok) return DEFAULT_BRANDING;
    const json = (await res.json()) as { value?: BrandingSettings };
    return json.value ?? DEFAULT_BRANDING;
  } catch {
    return DEFAULT_BRANDING;
  }
}

export default async function BrandingPage({ params }: Props) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const branding = await loadBranding(user.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {locale.startsWith('vi') ? 'Tuỳ Chỉnh Thương Hiệu' : 'Brand Customization'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {locale.startsWith('vi')
            ? 'Cá nhân hoá logo, màu sắc, email và metadata cho thương hiệu của bạn.'
            : 'Personalise your logo, colours, email sender, and social metadata.'}
        </p>
      </div>

      <BrandingFormClient
        locale={locale}
        userId={user.id}
        initialBranding={branding}
      />
    </div>
  );
}
