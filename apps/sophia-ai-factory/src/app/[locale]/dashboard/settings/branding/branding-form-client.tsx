'use client';

/**
 * BrandingFormClient — full branding customization form.
 * Saves on blur via PATCH /api/v1/settings/branding.
 * Uploads via POST /api/v1/branding/upload.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/settings/branding/branding-form-client
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { BrandingImageUploader } from './branding-image-uploader';

interface Props {
  locale: string;
  userId: string;
  initialBranding: BrandingSettings;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function BrandingFormClient({ locale, initialBranding }: Props) {
  const isVi = locale.startsWith('vi');
  const [branding, setBranding] = useState<BrandingSettings>(initialBranding);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const t = useTranslations('dashboard.settings.branding');

  async function savePatch(patch: Partial<BrandingSettings>) {
    setStatus('saving');
    try {
      const res = await fetch('/api/v1/settings/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Save failed');
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }

  function handleBlur(field: keyof BrandingSettings, value: string | null) {
    setBranding((prev) => ({ ...prev, [field]: value }));
    savePatch({ [field]: value });
  }

  function handleColorChange(field: 'primaryColor' | 'accentColor', value: string) {
    setBranding((prev) => ({ ...prev, [field]: value || null }));
  }

  function handleColorBlur(field: 'primaryColor' | 'accentColor') {
    savePatch({ [field]: branding[field] });
  }

  function handleSocialBlur(key: 'title' | 'description', value: string | null) {
    const updated = { ...(branding.socialMeta ?? { title: null, description: null, imageUrl: null }), [key]: value };
    setBranding((prev) => ({ ...prev, socialMeta: updated }));
    savePatch({ socialMeta: updated });
  }

  const inputCls =
    'w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <div className="space-y-8">
      {/* Status bar */}
      {status !== 'idle' && (
        <p className={`text-xs ${status === 'saved' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-muted-foreground'}`}>
          {status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : t('saveFailed')}
        </p>
      )}

      {/* Section 1: Logo */}
      <Section title={t('logo')}>
        <BrandingImageUploader
          kind="logo"
          currentUrl={branding.logoUrl}
          label={t('uploadLogo')}
          onUploaded={(url) => { setBranding((p) => ({ ...p, logoUrl: url })); savePatch({ logoUrl: url }); }}
          onRemoved={() => handleBlur('logoUrl', null)}
        />
      </Section>

      {/* Section 2: Agency Info */}
      <Section title={t('agencyName')}>
        <TextField
          label={t('agencyName')}
          value={branding.agencyName ?? ''}
          placeholder={t('agencyNamePlaceholder')}
          onBlur={(v) => handleBlur('agencyName', v || null)}
          inputCls={inputCls}
        />
      </Section>

      {/* Section 3: Brand colors */}
      <Section title={t('brandColors')}>
        <ColorField
          label={t('primaryColor')}
          value={branding.primaryColor}
          onChange={(v) => handleColorChange('primaryColor', v)}
          onBlur={() => handleColorBlur('primaryColor')}
        />
        <ColorField
          label={t('accentColor')}
          value={branding.accentColor ?? '#10b981'}
          onChange={(v) => handleColorChange('accentColor', v)}
          onBlur={() => handleColorBlur('accentColor')}
        />
      </Section>

      {/* Section 3: Welcome message */}
      <Section title={t('welcomeMessage')}>
        <label className="block text-sm text-muted-foreground mb-1">
          {t('welcomeMessageHint')}
        </label>
        <textarea
          className={`${inputCls} min-h-[100px] resize-y`}
          value={branding.welcomeMessage ?? ''}
          maxLength={2000}
          placeholder={t('welcomeMessagePlaceholder')}
          onChange={(e) => setBranding((p) => ({ ...p, welcomeMessage: e.target.value || null }))}
          onBlur={(e) => handleBlur('welcomeMessage', e.target.value || null)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {(branding.welcomeMessage ?? '').length}/2000
        </p>
      </Section>

      {/* Section 4: Email branding */}
      <Section title={t('emailBranding')}>
        <TextField
          label={t('fromName')}
          value={branding.emailFromName ?? ''}
          placeholder={t('fromNamePlaceholder')}
          onBlur={(v) => handleBlur('emailFromName', v || null)}
          inputCls={inputCls}
        />
        <label className="block text-sm text-muted-foreground mb-1 mt-3">
          {t('emailFooter')}
        </label>
        <textarea
          className={`${inputCls} min-h-[80px] resize-y`}
          value={branding.emailFooter ?? ''}
          maxLength={1000}
          placeholder={t('emailFooterPlaceholder')}
          onChange={(e) => setBranding((p) => ({ ...p, emailFooter: e.target.value || null }))}
          onBlur={(e) => handleBlur('emailFooter', e.target.value || null)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {(branding.emailFooter ?? '').length}/1000
        </p>
      </Section>

      {/* Section 5: Favicon */}
      <Section title={t('favicon')}>
        <BrandingImageUploader
          kind="favicon"
          currentUrl={branding.faviconUrl}
          label={t('uploadFavicon')}
          onUploaded={(url) => { setBranding((p) => ({ ...p, faviconUrl: url })); savePatch({ faviconUrl: url }); }}
          onRemoved={() => handleBlur('faviconUrl', null)}
        />
      </Section>

      {/* Section 6: Social Meta */}
      <Section title={t('socialMeta')}>
        <TextField
          label={t('ogTitle')}
          value={branding.socialMeta?.title ?? ''}
          placeholder={t('ogTitlePlaceholder')}
          onBlur={(v) => handleSocialBlur('title', v || null)}
          inputCls={inputCls}
        />
        <label className="block text-sm text-muted-foreground mb-1 mt-3">
          {t('ogDescription')}
        </label>
        <textarea
          className={`${inputCls} min-h-[60px] resize-y`}
          value={branding.socialMeta?.description ?? ''}
          maxLength={500}
          placeholder={t('ogDescriptionPlaceholder')}
          onChange={(e) => {
            const updated = { ...(branding.socialMeta ?? { title: null, description: null, imageUrl: null }), description: e.target.value || null };
            setBranding((p) => ({ ...p, socialMeta: updated }));
          }}
          onBlur={(e) => handleSocialBlur('description', e.target.value || null)}
        />
        <div className="mt-3">
          <BrandingImageUploader
            kind="social"
            currentUrl={branding.socialMeta?.imageUrl ?? null}
            label={t('ogImage')}
            onUploaded={(url) => {
              const updated = { ...(branding.socialMeta ?? { title: null, description: null, imageUrl: null }), imageUrl: url };
              setBranding((p) => ({ ...p, socialMeta: updated }));
              savePatch({ socialMeta: updated });
            }}
            onRemoved={() => {
              const updated = { ...(branding.socialMeta ?? { title: null, description: null, imageUrl: null }), imageUrl: null };
              setBranding((p) => ({ ...p, socialMeta: updated }));
              savePatch({ socialMeta: updated });
            }}
          />
        </div>
      </Section>

      {/* Section 7: Custom Domain */}
      <Section title={t('customDomain')}>
        <TextField
          label={t('domain')}
          value={branding.customDomain ?? ''}
          placeholder={t('domainPlaceholder')}
          onBlur={(v) => handleBlur('customDomain', v || null)}
          inputCls={inputCls}
        />
        <p className="text-xs text-amber-400 mt-2">
          {t('domainHint')}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card border-border p-6 space-y-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function TextField({
  label, value, placeholder, onBlur, inputCls,
}: {
  label: string;
  value: string;
  placeholder: string;
  onBlur: (v: string) => void;
  inputCls: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        className={inputCls}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
    </div>
  );
}

function ColorField({
  label, value, onChange, onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="#7c3aed"
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
    </div>
  );
}
