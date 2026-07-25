import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getOrDefault, set } from '@/seed/tenant-settings/registry';
import type { BrandingSchema } from '@/seed/tenant-settings/defaults';

export const dynamic = 'force-dynamic';

type BrandingState = {
  logoUrl: string | null;
  primaryColor: string;
  welcomeMessage: string | null;
  customDomain: string | null;
};

async function getBranding(): Promise<BrandingState> {
  const db = createServerClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const tenantId = user.id;
  const data = await getOrDefault<BrandingSchema>(db, tenantId, 'branding');
  return {
    logoUrl: data.logoUrl ?? null,
    primaryColor: data.primaryColor ?? '#7c3aed',
    welcomeMessage: data.welcomeMessage ?? null,
    customDomain: data.customDomain ?? null,
  };
}

async function updateBranding(formData: FormData) {
  'use server';
  const db = createServerClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const branding: BrandingSchema = {
    logoUrl: (formData.get('logoUrl') as string | null) ?? null,
    primaryColor: (formData.get('primaryColor') as string) ?? '#7c3aed',
    welcomeMessage: (formData.get('welcomeMessage') as string | null) ?? null,
    customDomain: (formData.get('customDomain') as string | null) ?? null,
  };
  await set(db, user.id, 'branding', branding);
}

export default async function BrandingPage() {
  const branding = await getBranding();
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Custom Theme Builder</h1>
      <p className="text-gray-600">
        White-label your workspace with custom logo, colors, and domain. MASTER tier unlocks full customization.
      </p>

      <form action={updateBranding} className="space-y-4 rounded border p-4">
        <div>
          <label className="block text-sm font-medium">Logo URL</label>
          <input
            name="logoUrl"
            defaultValue={branding.logoUrl ?? ''}
            placeholder="https://cdn.example.com/logo.png"
            className="mt-1 w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Primary Color</label>
          <input
            name="primaryColor"
            type="color"
            defaultValue={branding.primaryColor}
            className="mt-1 h-10 w-20"
          />
          <span className="ml-2 text-sm text-gray-500">{branding.primaryColor}</span>
        </div>

        <div>
          <label className="block text-sm font-medium">Welcome Message</label>
          <textarea
            name="welcomeMessage"
            defaultValue={branding.welcomeMessage ?? ''}
            placeholder="Welcome to your workspace"
            className="mt-1 w-full rounded border p-2"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Custom Domain</label>
          <input
            name="customDomain"
            defaultValue={branding.customDomain ?? ''}
            placeholder="https://acme.yourdomain.com"
            className="mt-1 w-full rounded border p-2"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Save Theme
        </button>
      </form>
    </div>
  );
}
