import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface PortalHeaderProps {
  isVi: boolean;
}

export function PortalHeader({ isVi }: PortalHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            {isVi ? 'Tích Hợp CRM Doanh Nghiệp & Lưới Webhook' : 'Enterprise CRM & Webhook Bus'}
          </h1>
          <span className="rounded-full bg-cyan-950 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-800">
            Pillar R2
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {isVi
            ? 'Đồng bộ hai chiều Salesforce & HubSpot, chữ ký mã hóa Web Crypto HMAC-SHA256, và bảo vệ hợp đồng Sophia Authority Bias.'
            : 'Bi-directional Salesforce & HubSpot sync, Web Crypto HMAC-SHA256 signing, and Sophia Authority Bias protection.'}
        </p>
      </div>

      {/* Global Authority Status Pill */}
      <div className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        <span>
          {isVi ? 'Quyền Uy Hợp Đồng: KÍCH HOẠT (LWW Bias)' : 'Contract Authority: ACTIVE (LWW Bias)'}
        </span>
      </div>
    </div>
  );
}
