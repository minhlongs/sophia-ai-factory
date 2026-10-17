"use client";

import React, { useState } from 'react';
import { ShieldCheck, User, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  ProductionPreferencesCard,
  WorkspaceIdentityCard,
  type AccountBrandTone,
  type AccountLanguage,
  type ProductionPreferencesCardProps,
  type WorkspaceIdentityCardProps,
} from './account-step-fields';

export {
  ProductionPreferencesCard,
  WorkspaceIdentityCard,
  type AccountBrandTone,
  type AccountLanguage,
  type ProductionPreferencesCardProps,
  type WorkspaceIdentityCardProps,
};

export interface AccountStepProps {
  onNext: () => void;
  onBack?: () => void;
  accountEmail?: string;
  isOwner?: boolean;
}

export function AccountStep({
  onNext,
  onBack,
  accountEmail = '',
  isOwner = false,
}: AccountStepProps) {
  const [workspaceName, setWorkspaceName] = useState('Sophia Video Empire');
  const [language, setLanguage] = useState<AccountLanguage>('vi');
  const [brandTone, setBrandTone] = useState<AccountBrandTone>('viral');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 border ${isOwner ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-[#D97706]/10 dark:bg-[#F59E0B]/10 text-[#D97706] dark:text-[#F59E0B] border-[#D97706]/20 dark:border-[#F59E0B]/20'}`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          {isOwner ? 'Owner Verified / Đã xác thực chủ sở hữu' : 'Pending Verification / Chờ xác thực'}
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">
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
        <div className="p-4 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Ownership Identity / Danh tính sở hữu
              </h3>
              <p className="text-xs text-muted-foreground font-mono">{accountEmail || 'Pending authentication...'}</p>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border dark:border-white/[0.08] text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Role / Vai trò:</span>
              <span className="font-mono font-semibold text-[#4338CA] dark:text-[#6366F1] bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 px-2 py-0.5 rounded">
                {isOwner ? 'OWNER / Quản trị cao nhất' : 'MEMBER / Thành viên'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Status / Trạng thái:</span>
              <span className={isOwner ? "text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1" : "text-[#D97706] dark:text-[#F59E0B] font-semibold flex items-center gap-1"}>
                {isOwner ? '✓ Active Owner / Chủ sở hữu' : '⏳ Pending Review / Chờ phê duyệt'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Tenant Access:</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium">Isolated & Secure (AES-256)</span>
            </div>
          </div>
        </div>

        {/* Workspace Identity Card */}
        <WorkspaceIdentityCard
          workspaceName={workspaceName}
          onWorkspaceNameChange={setWorkspaceName}
        />
      </div>

      {/* Preferences */}
      <ProductionPreferencesCard
        language={language}
        onLanguageChange={setLanguage}
        brandTone={brandTone}
        onBrandToneChange={setBrandTone}
      />

      <div className="flex justify-between items-center pt-4 border-t border-border dark:border-white/[0.08]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại / Back
          </button>
        ) : <div />}
        <button
          type="button"
          onClick={onNext}
          className="bg-[#4338CA] dark:bg-[#6366F1] hover:opacity-95 text-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 shadow-xs"
        >
          Tiếp tục / Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
