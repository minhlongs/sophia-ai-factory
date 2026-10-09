'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import type { PartnerDashboardData } from '@/tree/partners/types';
import { WhitelabelConfigForm } from './whitelabel-config-form';
import { WhitelabelDnsCard } from './whitelabel-dns-card';

interface TabWhitelabelProps {
  isPlatinum: boolean;
  isVi: boolean;
  wlConfig: PartnerDashboardData['whitelabelConfig'];
  wlBrandName: string;
  setWlBrandName: (val: string) => void;
  wlDomain: string;
  setWlDomain: (val: string) => void;
  wlPrimaryColor: string;
  setWlPrimaryColor: (val: string) => void;
  wlAccentColor: string;
  setWlAccentColor: (val: string) => void;
  wlLogoUrl: string;
  setWlLogoUrl: (val: string) => void;
  wlSupportUrl: string;
  setWlSupportUrl: (val: string) => void;
  wlSuccessMsg: string | null;
  wlErrorMsg: string | null;
  dnsVerifyMsg: string | null;
  isPending: boolean;
  onSaveWhitelabel: (e: React.FormEvent) => void;
  onVerifyDns: () => void;
}

export function TabWhitelabel({
  isPlatinum,
  isVi,
  wlConfig,
  wlBrandName,
  setWlBrandName,
  wlDomain,
  setWlDomain,
  wlPrimaryColor,
  setWlPrimaryColor,
  wlAccentColor,
  setWlAccentColor,
  wlLogoUrl,
  setWlLogoUrl,
  wlSupportUrl,
  setWlSupportUrl,
  wlSuccessMsg,
  wlErrorMsg,
  dnsVerifyMsg,
  isPending,
  onSaveWhitelabel,
  onVerifyDns,
}: TabWhitelabelProps) {
  if (!isPlatinum) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
          <Globe className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-zinc-100">
          {isVi ? 'Tính Năng Độc Quyền Cấp PLATINUM' : 'Exclusive PLATINUM Tier Feature'}
        </h3>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          {isVi
            ? 'Tự động mở khóa khi bạn đạt 30 khách hàng trả phí hoặc $20,000 MRR giới thiệu. Cho phép bạn chạy Sophia dưới tên miền riêng, logo riêng và giao diện thương hiệu độc quyền.'
            : 'Unlocks automatically upon reaching 30 paying referrals or $20,000 referred MRR. Rebrand the entire Sophia AI Factory under your sovereign domain, logo, and theme.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <WhitelabelConfigForm
        isVi={isVi}
        wlBrandName={wlBrandName}
        setWlBrandName={setWlBrandName}
        wlDomain={wlDomain}
        setWlDomain={setWlDomain}
        wlPrimaryColor={wlPrimaryColor}
        setWlPrimaryColor={setWlPrimaryColor}
        wlAccentColor={wlAccentColor}
        setWlAccentColor={setWlAccentColor}
        wlLogoUrl={wlLogoUrl}
        setWlLogoUrl={setWlLogoUrl}
        wlSupportUrl={wlSupportUrl}
        setWlSupportUrl={setWlSupportUrl}
        wlSuccessMsg={wlSuccessMsg}
        wlErrorMsg={wlErrorMsg}
        isPending={isPending}
        onSaveWhitelabel={onSaveWhitelabel}
      />
      <WhitelabelDnsCard
        isVi={isVi}
        wlConfig={wlConfig}
        dnsVerifyMsg={dnsVerifyMsg}
        isPending={isPending}
        onVerifyDns={onVerifyDns}
      />
    </div>
  );
}
