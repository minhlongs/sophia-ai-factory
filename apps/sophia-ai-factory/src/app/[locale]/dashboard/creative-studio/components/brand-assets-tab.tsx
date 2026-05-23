'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/seed/components/ui/button';
import { BrandAssetCard } from './brand-asset-card';
import type { Tier } from '@/seed/types';

interface BrandingValue {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  emailFromName: string | null;
  welcomeMessage: string | null;
}

interface BrandingResponse {
  namespace: string;
  value: BrandingValue;
}

interface BrandAssetsTabProps {
  tier: Tier;
}

export function BrandAssetsTab({ tier }: BrandAssetsTabProps) {
  void tier;
  const t = useTranslations('creativeStudio.brand');
  const [branding, setBranding] = useState<BrandingValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/v1/settings/branding')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: BrandingResponse = await res.json();
        if (!cancelled) setBranding(data.value);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load branding');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const hasAnyBranding =
    branding &&
    (branding.logoUrl || branding.primaryColor !== '#7C3AED' || branding.accentColor);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        {t('loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (!hasAnyBranding) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-lg border border-dashed border-border">
        <div className="text-center">
          <p className="font-medium text-sm">{t('emptyTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('emptyDescription')}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/settings/branding">{t('setupBrandKit')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('brandKit')}</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/settings/branding">{t('editBrand')}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {branding?.logoUrl && (
          <BrandAssetCard
            type="logo"
            label={t('logo')}
            value={branding.logoUrl}
            preview={branding.logoUrl}
          />
        )}

        {branding?.primaryColor && (
          <BrandAssetCard
            type="color"
            label={t('primaryColor')}
            value={branding.primaryColor}
          />
        )}

        {branding?.accentColor && (
          <BrandAssetCard
            type="color"
            label={t('accentColor')}
            value={branding.accentColor}
          />
        )}

        {branding?.emailFromName && (
          <BrandAssetCard
            type="font"
            label={t('brandName')}
            value={branding.emailFromName}
          />
        )}
      </div>
    </div>
  );
}
