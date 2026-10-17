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
    <div className="p-4 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
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
        className="w-full px-3.5 py-2 text-sm rounded-lg border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
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
    <div className="p-4 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Globe className="w-4 h-4 text-[#4338CA] dark:text-[#6366F1]" />
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
                  ? 'border-[#4338CA] dark:border-[#6366F1] bg-[#4338CA]/10 dark:bg-[#6366F1]/15 text-[#4338CA] dark:text-[#6366F1] font-semibold'
                  : 'border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] text-muted-foreground hover:text-foreground'
              }`}
            >
              🇻🇳 Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                language === 'en'
                  ? 'border-[#4338CA] dark:border-[#6366F1] bg-[#4338CA]/10 dark:bg-[#6366F1]/15 text-[#4338CA] dark:text-[#6366F1] font-semibold'
                  : 'border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] text-muted-foreground hover:text-foreground'
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
                    ? 'border-[#4338CA] dark:border-[#6366F1] bg-[#4338CA]/10 dark:bg-[#6366F1]/15 text-[#4338CA] dark:text-[#6366F1] font-semibold'
                    : 'border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] text-muted-foreground hover:text-foreground'
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
