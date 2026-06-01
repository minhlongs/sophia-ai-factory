'use client';

/**
 * BrandingFormClient — full branding customization form.
 * Saves on blur via PATCH /api/v1/settings/branding.
 * Uploads via POST /api/v1/branding/upload.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/settings/branding/branding-form-client
 */

import { useState, useCallback } from 'react';
import type { BrandingSettings } from '@/land/tenant-settings/defaults';
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

  const t = useCallback(
    (en: string, vi: string) => (isVi ? vi : en),
    [isVi],
  );

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
    'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <div className="space-y-8">
      {/* Status bar */}
      {status !== 'idle' && (
        <p className={`text-xs ${status === 'saved' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
          {status === 'saving' ? t('Saving…', 'Đang lưu…') : status === 'saved' ? t('Saved', 'Đã lưu') : t('Save failed', 'Lỗi khi lưu')}
        </p>
      )}

      {/* Section 1: Logo */}
      <Section title={t('Logo', 'Logo')}>
        <BrandingImageUploader
          kind="logo"
          currentUrl={branding.logoUrl}
          label={t('Upload Logo (PNG, JPG, SVG, WebP — max 2 MB)', 'Tải Logo (PNG, JPG, SVG, WebP — tối đa 2 MB)')}
          onUploaded={(url) => { setBranding((p) => ({ ...p, logoUrl: url })); savePatch({ logoUrl: url }); }}
          onRemoved={() => handleBlur('logoUrl', null)}
        />
      </Section>

      {/* Section 2: Brand colors */}
      <Section title={t('Brand Colors', 'Màu Thương Hiệu')}>
        <ColorField
          label={t('Primary Color', 'Màu Chính')}
          value={branding.primaryColor}
          onChange={(v) => handleColorChange('primaryColor', v)}
          onBlur={() => handleColorBlur('primaryColor')}
        />
        <ColorField
          label={t('Accent Color', 'Màu Phụ')}
          value={branding.accentColor ?? '#10b981'}
          onChange={(v) => handleColorChange('accentColor', v)}
          onBlur={() => handleColorBlur('accentColor')}
        />
      </Section>

      {/* Section 3: Welcome message */}
      <Section title={t('Welcome Message', 'Lời Chào')}>
        <label className="block text-sm text-zinc-300 mb-1">
          {t('Markdown supported, max 2000 chars', 'Hỗ trợ Markdown, tối đa 2000 ký tự')}
        </label>
        <textarea
          className={`${inputCls} min-h-[100px] resize-y`}
          value={branding.welcomeMessage ?? ''}
          maxLength={2000}
          placeholder={t('Welcome to our platform!', 'Chào mừng đến nền tảng của chúng tôi!')}
          onChange={(e) => setBranding((p) => ({ ...p, welcomeMessage: e.target.value || null }))}
          onBlur={(e) => handleBlur('welcomeMessage', e.target.value || null)}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {(branding.welcomeMessage ?? '').length}/2000
        </p>
      </Section>

      {/* Section 4: Email branding */}
      <Section title={t('Email Branding', 'Thương Hiệu Email')}>
        <TextField
          label={t('From Name', 'Tên người gửi')}
          value={branding.emailFromName ?? ''}
          placeholder={t('Acme Corp', 'Công ty ABC')}
          onBlur={(v) => handleBlur('emailFromName', v || null)}
          inputCls={inputCls}
        />
        <label className="block text-sm text-zinc-300 mb-1 mt-3">
          {t('Email Footer (Markdown, max 1000 chars)', 'Chân email (Markdown, tối đa 1000 ký tự)')}
        </label>
        <textarea
          className={`${inputCls} min-h-[80px] resize-y`}
          value={branding.emailFooter ?? ''}
          maxLength={1000}
          placeholder={t('© 2025 Acme Corp | Unsubscribe', '© 2025 Công ty ABC | Hủy đăng ký')}
          onChange={(e) => setBranding((p) => ({ ...p, emailFooter: e.target.value || null }))}
          onBlur={(e) => handleBlur('emailFooter', e.target.value || null)}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {(branding.emailFooter ?? '').length}/1000
        </p>
      </Section>

      {/* Section 5: Favicon */}
      <Section title={t('Favicon', 'Favicon')}>
        <BrandingImageUploader
          kind="favicon"
          currentUrl={branding.faviconUrl}
          label={t('Upload Favicon (PNG, ICO, SVG — max 2 MB)', 'Tải Favicon (PNG, ICO, SVG — tối đa 2 MB)')}
          onUploaded={(url) => { setBranding((p) => ({ ...p, faviconUrl: url })); savePatch({ faviconUrl: url }); }}
          onRemoved={() => handleBlur('faviconUrl', null)}
        />
      </Section>

      {/* Section 6: Social Meta */}
      <Section title={t('Social Meta (OG / Twitter)', 'Mạng Xã Hội (OG / Twitter)')}>
        <TextField
          label={t('OG Title', 'Tiêu đề OG')}
          value={branding.socialMeta?.title ?? ''}
          placeholder={t('My Brand — AI Platform', 'Thương Hiệu — Nền Tảng AI')}
          onBlur={(v) => handleSocialBlur('title', v || null)}
          inputCls={inputCls}
        />
        <label className="block text-sm text-zinc-300 mb-1 mt-3">
          {t('OG Description', 'Mô tả OG')}
        </label>
        <textarea
          className={`${inputCls} min-h-[60px] resize-y`}
          value={branding.socialMeta?.description ?? ''}
          maxLength={500}
          placeholder={t('Describe your brand in one sentence.', 'Mô tả thương hiệu trong một câu.')}
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
            label={t('OG Image (1200×630, max 2 MB)', 'Ảnh OG (1200×630, tối đa 2 MB)')}
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
      <Section title={t('Custom Domain', 'Tên Miền Tuỳ Chỉnh')}>
        <TextField
          label={t('Domain', 'Tên miền')}
          value={branding.customDomain ?? ''}
          placeholder="app.yourbrand.com"
          onBlur={(v) => handleBlur('customDomain', v || null)}
          inputCls={inputCls}
        />
        <p className="text-xs text-amber-400 mt-2">
          {t('DNS CNAME setup required after saving. Contact support for instructions.', 'Cần cấu hình DNS CNAME sau khi lưu. Liên hệ hỗ trợ để được hướng dẫn.')}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3">
      <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">{title}</h2>
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
      <label className="block text-sm text-zinc-300 mb-1">{label}</label>
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
      <label className="block text-sm text-zinc-300 mb-1">{label}</label>
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
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
    </div>
  );
}
