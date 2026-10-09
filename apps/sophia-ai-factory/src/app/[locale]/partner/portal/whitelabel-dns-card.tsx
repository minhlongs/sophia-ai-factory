'use client';

import React from 'react';
import type { PartnerDashboardData } from '@/tree/partners/types';

interface WhitelabelDnsCardProps {
  isVi: boolean;
  wlConfig: PartnerDashboardData['whitelabelConfig'];
  dnsVerifyMsg: string | null;
  isPending: boolean;
  onVerifyDns: () => void;
}

export function WhitelabelDnsCard({
  isVi,
  wlConfig,
  dnsVerifyMsg,
  isPending,
  onVerifyDns,
}: WhitelabelDnsCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-zinc-100">
          {isVi ? 'Xác Thực DNS Tên Miền' : 'DNS Verification & SSL'}
        </h3>
        <p className="text-xs text-zinc-400">
          {isVi
            ? 'Cấu hình bản ghi DNS để kích hoạt chứng chỉ SSL tự động.'
            : 'Add TXT record to verify ownership and provision SSL.'}
        </p>
      </div>

      {wlConfig?.custom_domain ? (
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1 font-mono">
            <span className="text-zinc-500 uppercase text-[10px]">TXT Host:</span>
            <p className="text-zinc-200">_sophia-verify.{wlConfig.custom_domain}</p>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1 font-mono break-all">
            <span className="text-zinc-500 uppercase text-[10px]">TXT Value / Token:</span>
            <p className="text-cyan-400">
              {wlConfig.dns_txt_verification_token || 'Token pending save'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  wlConfig.is_ssl_active ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-xs text-zinc-300">
                {wlConfig.is_ssl_active
                  ? isVi
                    ? 'SSL Hoạt Động'
                    : 'SSL Active'
                  : isVi
                  ? 'Chờ Xác Thực DNS'
                  : 'Pending DNS'}
              </span>
            </div>

            <button
              type="button"
              onClick={onVerifyDns}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
            >
              {isVi ? 'Kiểm Tra DNS' : 'Verify DNS'}
            </button>
          </div>

          {dnsVerifyMsg && (
            <p className="text-[11px] text-cyan-400 pt-1">{dnsVerifyMsg}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          {isVi
            ? 'Vui lòng nhập tên miền tùy chỉnh ở form bên cạnh trước.'
            : 'Configure your custom domain first to generate DNS verification instructions.'}
        </p>
      )}
    </div>
  );
}
