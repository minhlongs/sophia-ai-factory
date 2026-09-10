"use client";

import React, { useState } from 'react';
import { ShieldCheck, Building2, User, Globe, ArrowRight, ArrowLeft } from 'lucide-react';

interface AccountStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function AccountStep({ onNext, onBack }: AccountStepProps) {
  const [workspaceName, setWorkspaceName] = useState('Sophia Video Empire');
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [brandTone, setBrandTone] = useState<'professional' | 'viral' | 'friendly'>('viral');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Owner Verified / Đã xác thực chủ sở hữu
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Account & Workspace / Tài khoản & Tổ chức
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your ownership role and configure your primary video workspace.
          <br />
          Xác nhận danh tính sở hữu và thiết lập không gian sản xuất video chính của bạn.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Account Identity Card */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Ownership Identity / Danh tính sở hữu
              </h3>
              <p className="text-xs text-muted-foreground">Primary Account Holder</p>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Role / Vai trò:</span>
              <span className="font-semibold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded">
                OWNER / Quản trị cao nhất
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Tenant Access:</span>
              <span className="text-emerald-600 font-medium">Isolated & Secure (AES-256)</span>
            </div>
          </div>
        </div>

        {/* Workspace Identity Card */}
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
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="e.g. My Media Brand"
          />
        </div>
      </div>

      {/* Preferences */}
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
                onClick={() => setLanguage('vi')}
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
                onClick={() => setLanguage('en')}
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
                  onClick={() => setBrandTone(tone)}
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

      <div className="flex justify-between items-center pt-4 border-t border-border">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại / Back
          </button>
        ) : <div />}
        <button
          type="button"
          onClick={onNext}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
        >
          Tiếp tục / Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
