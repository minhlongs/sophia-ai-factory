import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { KeyRound, ArrowUpRight } from 'lucide-react';

export function StitchByokVaultBanner() {
  const isVi = useLocale() === 'vi';

  return (
    <section
      aria-label={isVi ? 'Quản lý khóa BYOK và xuất dữ liệu workspace' : 'BYOK key management and workspace export'}
      data-testid="stitch-byok-vault-banner"
      className="mx-auto mb-6 max-w-6xl px-4 pt-4 md:px-6"
    >
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#10B981]/40 bg-[#11131F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-[#10B981]">
                {isVi ? 'QUẢN LÝ KHÓA BYOK' : 'BYOK KEY MANAGEMENT'}
              </span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary-200">
                {isVi ? 'XUẤT WORKSPACE' : 'WORKSPACE EXPORT'}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-sm font-semibold text-[#F8FAFC]">
              {isVi
                ? 'Quản lý khóa nhà cung cấp và xuất dữ liệu workspace.'
                : 'Manage provider keys and export workspace data.'}
            </h2>
          </div>
        </div>

        <Link
          href="/dashboard/control-deck"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#1E2235] bg-[#1A1C28] px-3.5 py-2 font-mono text-xs font-semibold text-primary-200 transition-colors hover:border-primary hover:text-[#F8FAFC]"
        >
          <span>{isVi ? 'Quản Lý Khóa BYOK' : 'BYOK Key Management'}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
