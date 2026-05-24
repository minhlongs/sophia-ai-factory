'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { BrandAssetCard } from './brand-asset-card';
import {
  getBrandKitAction,
  saveBrandKitAction,
  uploadBrandAssetAction,
  removeBrandAssetAction,
} from '@/app/actions/brand-kit-action';
import type { Tier } from '@/seed/types';
import { Upload, Trash2, Loader2 } from 'lucide-react';

interface BrandAssetsTabProps {
  tier: Tier;
}

const POSITION_OPTIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;

export function BrandAssetsTab({ tier }: BrandAssetsTabProps) {
  void tier;
  const t = useTranslations('creativeStudio.brand');
  const [kit, setKit] = useState<{
    primary_color: string;
    secondary_color: string;
    logo_r2_key: string | null;
    intro_r2_key: string | null;
    outro_r2_key: string | null;
    font_r2_key: string | null;
    logo_position: string;
    logo_opacity: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    getBrandKitAction().then((res) => {
      if (res.success && res.data) {
        setKit(res.data);
      }
      setLoading(false);
    }).catch(() => {
      setError('Failed to load brand kit');
      setLoading(false);
    });
  }, []);

  function handleSave(field: string, value: string | number) {
    startSave(async () => {
      const res = await saveBrandKitAction({ [field]: value });
      if (res.success && res.data) setKit(res.data);
    });
  }

  async function handleUpload(assetType: string, file: File) {
    setUploading(assetType);
    const formData = new FormData();
    formData.set('file', file);
    formData.set('assetType', assetType);
    const res = await uploadBrandAssetAction(formData);
    if (res.success && res.data) setKit(res.data);
    else if (!res.success) setError(res.error);
    setUploading(null);
  }

  async function handleRemove(assetType: string) {
    const res = await removeBrandAssetAction(assetType);
    if (res.success && res.data) setKit(res.data);
  }

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

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold">{t('brandKit')}</h2>

      {/* Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('colors')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <ColorField
            label={t('primaryColor')}
            value={kit?.primary_color ?? '#000000'}
            onSave={(v) => handleSave('primaryColor', v)}
          />
          <ColorField
            label={t('secondaryColor')}
            value={kit?.secondary_color ?? '#FFFFFF'}
            onSave={(v) => handleSave('secondaryColor', v)}
          />
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('logo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {kit?.logo_r2_key ? (
            <div className="flex items-center justify-between">
              <BrandAssetCard type="logo" label={t('logo')} value={kit.logo_r2_key} />
              <Button variant="ghost" size="icon" onClick={() => handleRemove('logo')}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <AssetUploader
              assetType="logo"
              accept="image/*"
              loading={uploading === 'logo'}
              onUpload={(f) => handleUpload('logo', f)}
              label={t('uploadLogo')}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">{t('logoPosition')}</Label>
              <select
                value={kit?.logo_position ?? 'bottom-right'}
                onChange={(e) => handleSave('logoPosition', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('logoOpacity')}</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={kit?.logo_opacity ?? 0.8}
                onChange={(e) => handleSave('logoOpacity', parseFloat(e.target.value))}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intro / Outro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <VideoAssetCard
          assetType="intro"
          r2Key={kit?.intro_r2_key ?? null}
          label={t('intro')}
          uploadLabel={t('uploadIntro')}
          uploading={uploading === 'intro'}
          onUpload={(f) => handleUpload('intro', f)}
          onRemove={() => handleRemove('intro')}
        />
        <VideoAssetCard
          assetType="outro"
          r2Key={kit?.outro_r2_key ?? null}
          label={t('outro')}
          uploadLabel={t('uploadOutro')}
          uploading={uploading === 'outro'}
          onUpload={(f) => handleUpload('outro', f)}
          onRemove={() => handleRemove('outro')}
        />
      </div>

      {/* Font */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('font')}</CardTitle>
        </CardHeader>
        <CardContent>
          {kit?.font_r2_key ? (
            <div className="flex items-center justify-between">
              <BrandAssetCard type="font" label={t('font')} value={kit.font_r2_key} />
              <Button variant="ghost" size="icon" onClick={() => handleRemove('font')}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <AssetUploader
              assetType="font"
              accept=".ttf,.otf,.woff,.woff2"
              loading={uploading === 'font'}
              onUpload={(f) => handleUpload('font', f)}
              label={t('uploadFont')}
            />
          )}
        </CardContent>
      </Card>

      {saving && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> {t('saving')}
        </div>
      )}
    </div>
  );
}

function AssetUploader({
  assetType,
  accept,
  loading,
  onUpload,
  label,
}: {
  assetType: string;
  accept: string;
  loading: boolean;
  onUpload: (file: File) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-center gap-2 h-20 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
        disabled={loading}
      />
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </>
      )}
    </label>
  );
}

function ColorField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (local !== value) onSave(local); }}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <span className="text-xs text-muted-foreground">{local}</span>
      </div>
    </div>
  );
}

function VideoAssetCard({
  assetType,
  r2Key,
  label,
  uploadLabel,
  uploading,
  onUpload,
  onRemove,
}: {
  assetType: string;
  r2Key: string | null;
  label: string;
  uploadLabel: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {r2Key ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r2Key}</span>
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <AssetUploader
            assetType={assetType}
            accept="video/*"
            loading={uploading}
            onUpload={onUpload}
            label={uploadLabel}
          />
        )}
      </CardContent>
    </Card>
  );
}
