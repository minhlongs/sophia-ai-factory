import React from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { COPY_TEMPLATES, BANNER_SPECS, fillRefLink } from '@/land/affiliates/promo-library';
import type { AssetLanguage } from './types';

interface MarketingAssetsTabProps {
  isVi: boolean;
  assetLang: AssetLanguage;
  setAssetLang: (lang: AssetLanguage) => void;
  primaryShareLink: string;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
}

export function MarketingAssetsTab({
  isVi,
  assetLang,
  setAssetLang,
  primaryShareLink,
  copiedKey,
  copyToClipboard,
}: MarketingAssetsTabProps) {
  const filteredTemplates = COPY_TEMPLATES.filter((t) => t.locale === assetLang);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {isVi ? 'Nội Dung Mẫu & Kịch Bản Đã Gắn Link Của Bạn' : 'High-Converting Copy & Scripts (Pre-linked)'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAssetLang('vi')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              assetLang === 'vi' ? 'bg-primary-500 text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            🇻🇳 Tiếng Việt
          </button>
          <button
            type="button"
            onClick={() => setAssetLang('en')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              assetLang === 'en' ? 'bg-primary-500 text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            🇺🇸 English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const bodyWithLink = fillRefLink(template.body, primaryShareLink);
          return (
            <div key={template.id} className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                  <span>{template.channel} • {template.niche}</span>
                  <span className="text-primary-400">{template.minTier}+</span>
                </div>
                <p className="text-xs text-foreground/90 mt-2 whitespace-pre-wrap leading-relaxed">
                  {bodyWithLink}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(bodyWithLink, template.id)}
                className="self-end inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border rounded-lg text-xs font-medium transition"
              >
                {copiedKey === template.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === template.id ? (isVi ? 'Đã sao chép' : 'Copied') : (isVi ? 'Sao chép mẫu' : 'Copy Template')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Ad Banners */}
      <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Download className="w-4 h-4 text-cyan-400" />
          {isVi ? 'Kích Thước Banner Quảng Cáo Chuẩn IAB' : 'Standard IAB Banner Specifications'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BANNER_SPECS.map((b) => (
            <div key={b.id} className="border border-border bg-muted/30 p-3 rounded-lg text-center space-y-1">
              <div className="font-mono text-sm font-bold text-foreground">{b.size}</div>
              <div className="text-[11px] text-muted-foreground uppercase">{b.format} • {b.minTier}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
