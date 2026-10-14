"use client";

import React from 'react';
import { Building2, Globe } from 'lucide-react';

export type AccountLanguage = 'vi' | 'en';
export type AccountBrandTone = 'professional' | 'viral' | 'friendly';

export interface WorkspaceIdentityCardProps {
  workspaceName: string;
  onWorkspaceNameChange: (value: string) => void;
}

export function WorkspaceIdentityCard({
  workspaceName,
  onWorkspaceNameChange,
}: WorkspaceIdentityCardProps) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Workspace Name / Tên không gian
          </h3>
          <p className="text-xs text-muted-foreground">Default video channel organization</p>
        </div>
      </div>
      <input
        type="text"
        value={workspaceName}
        onChange={(e) => onWorkspaceNameChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        placeholder="e.g. My Media Brand"
      />
    </div>
  );
}

export interface ProductionPreferencesCardProps {
  language: AccountLanguage;
  onLanguageChange: (lang: AccountLanguage) => void;
  brandTone: AccountBrandTone;
  onBrandToneChange: (tone: AccountBrandTone) => void;
}

export function ProductionPreferencesCard({
  language,
  onLanguageChange,
  brandTone,
  onBrandToneChange,
}: ProductionPreferencesCardProps) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Globe className="w-4 h-4 text-primary" />
        Production Preferences / Tùy chọn sản xuất
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">
            Primary Language / Ngôn ngữ chính
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange('vi')}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                language === 'vi'
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              🇻🇳 Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                language === 'en'
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">
            Brand Tone / Phong cách video
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['viral', 'professional', 'friendly'] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => onBrandToneChange(tone)}
                className={`px-2 py-2 text-xs capitalize rounded-lg border transition-all ${
                  brandTone === tone
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
