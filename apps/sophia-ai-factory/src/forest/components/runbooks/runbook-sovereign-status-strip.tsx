import React from 'react';
import { Link } from '@/navigation';
import { ShieldCheck, BookOpen, KeyRound, Cpu, ArrowUpRight } from 'lucide-react';

export interface RunbookSovereignStatusStripProps {
  readonly isVi?: boolean;
  readonly handoverStatus?: string;
  readonly certificateHash?: string | null;
  readonly installedSopCount?: number;
  readonly readinessScore?: number;
  readonly readyForMissions?: boolean;
}

export function RunbookSovereignStatusStrip({
  isVi = false,
  handoverStatus = 'active',
  certificateHash = null,
  installedSopCount = 0,
  readinessScore = 100,
  readyForMissions = true,
}: RunbookSovereignStatusStripProps) {
  const shortHash = certificateHash ? certificateHash.slice(0, 12) : null;

  return (
    <section
      role="region"
      aria-label={isVi ? 'Trạng Thái Vận Hành Tối Thượng' : 'Sovereign Operational Status'}
      className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#121722] via-[#101520] to-[#0B0E14] p-4 text-[#F8FAFC] shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:p-5"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {isVi ? 'D1 TRỰC TUYẾN · CHỦ QUYỀN 100%' : 'D1 LIVE · 100% SOVEREIGN'}
            </span>
            <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300 uppercase">
              {handoverStatus === 'accepted' ? (isVi ? 'ĐÃ BÀN GIAO & KÝ' : 'ACCEPTED & SIGNED') : (isVi ? 'SẴN SÀNG VẬN HÀNH' : 'OPERATIONAL READY')}
            </span>
          </div>

          <h2 className="mt-1.5 break-words font-sans text-sm font-semibold tracking-tight text-[#F8FAFC] sm:text-base">
            {isVi ? 'Bàn Giao Kỹ Thuật & Tài Liệu Vận Hành Tiêu Chuẩn (SOP)' : 'Engineering Handover & Standard Operating Procedures (SOP)'}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#94A3B8]">
            <div className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>{isVi ? `SOP đã cài: ${installedSopCount}` : `Installed SOPs: ${installedSopCount}`}</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>{isVi ? `Sẵn sàng: ${readinessScore}%` : `Readiness: ${readinessScore}%`}</span>
            </div>
            {shortHash && (
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-indigo-300">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>SHA: {shortHash}…</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/handover"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/15 px-4 py-2 font-mono text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-400/25 hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none"
          >
            <span>{isVi ? 'Hồ Sơ Bàn Giao' : 'Handover Record'}</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard/sops"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#1E2638] bg-[#0B0E14]/90 px-3.5 py-2 font-mono text-xs font-medium text-[#94A3B8] transition-colors hover:border-amber-400/40 hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none"
          >
            <span>{isVi ? 'Quản Lý SOP' : 'My SOPs'}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
