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
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium mb-2 ${isOwner ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          {isOwner ? 'Owner Verified / Đã xác thực chủ sở hữu' : 'Pending Verification / Chờ xác thực'}
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
              <p className="text-xs text-muted-foreground font-mono">{accountEmail || 'Pending authentication...'}</p>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Role / Vai trò:</span>
              <span className="font-semibold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded">
                {isOwner ? 'OWNER / Quản trị cao nhất' : 'MEMBER / Thành viên'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Status / Trạng thái:</span>
              <span className={isOwner ? "text-emerald-600 font-semibold flex items-center gap-1" : "text-amber-600 font-semibold flex items-center gap-1"}>
                {isOwner ? '✓ Active Owner / Chủ sở hữu' : '⏳ Pending Review / Chờ phê duyệt'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Tenant Access:</span>
              <span className="text-emerald-600 font-medium">Isolated & Secure (AES-256)</span>
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
