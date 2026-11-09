'use client';

/**
 * Workspace Partner Network Management Card (Cloud-Gated)
 * @module components/affiliates/workspace/workspace-partner-network-card
 */

import React, { useState } from 'react';
import {
  listWorkspacePartnersAction,
  reviewWorkspacePartnerStatusAction,
  createWorkspaceDualRailBatchAction,
} from '@/forest/actions/workspace-partner-network-actions';
import type { WorkspacePartnerSummary } from '@/forest/actions/workspace-partner-network-schema';
import { WorkspacePartnerRecruitForm } from './workspace-partner-recruit-form';
import { WorkspacePartnerTable } from './workspace-partner-table';

interface WorkspacePartnerNetworkCardProps {
  initialPartners: WorkspacePartnerSummary[];
  cloudGateAllowed: boolean;
  locale: string;
}

export function WorkspacePartnerNetworkCard({
  initialPartners,
  cloudGateAllowed,
  locale,
}: WorkspacePartnerNetworkCardProps) {
  const isVi = locale === 'vi';
  const [partners, setPartners] = useState<WorkspacePartnerSummary[]>(initialPartners);
  const [showRecruit, setShowRecruit] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const refreshPartners = async () => {
    const res = await listWorkspacePartnersAction();
    if (res.success && res.partners) setPartners(res.partners);
  };

  const handleReview = async (partnerId: string, decision: 'approve' | 'suspend') => {
    const res = await reviewWorkspacePartnerStatusAction({ partnerId, decision });
    if (res.success) {
      const msgVi = decision === 'approve' ? 'Đã duyệt CTV sang trạng thái Active — đủ điều kiện nhận chi trả.' : 'Đã đình chỉ CTV.';
      const msgEn = decision === 'approve' ? 'Partner approved to Active — unlocked for payout batches.' : 'Partner suspended.';
      setStatusNotice(isVi ? msgVi : msgEn);
      await refreshPartners();
    } else if (res.error) {
      setStatusNotice(res.error);
    }
  };

  const handleExportBatch = async () => {
    const res = await createWorkspaceDualRailBatchAction({ rail: 'COMBINED', minPayoutCents: 5000 });
    if (res.success && res.batch) {
      setCsvPreview(res.vietQrCsv ?? null);
      setStatusNotice(
        isVi
          ? `Đã tạo lô ${res.batch.batchId}: ${res.batch.itemCount} CTV Active (giữ lại tự động các CTV under_review).`
          : `Created batch ${res.batch.batchId}: ${res.batch.itemCount} Active partners (under_review automatically held back).`,
      );
    } else if (res.error) {
      setStatusNotice(res.error);
    }
  };

  if (!cloudGateAllowed) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-foreground">
          {isVi ? 'Quản Lý Mạng Lưới CTV & Chi Trả Dual-Rail (Sophia Cloud)' : 'Workspace Partner Network & Dual-Rail Payouts (Sophia Cloud)'}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {isVi
            ? 'Nâng cấp lên Sophia Cloud hoặc Enterprise để tuyển CTV riêng cho Workspace, duyệt cờ rủi ro under_review và xuất lô chi trả VietQR / USDT.'
            : 'Upgrade to Sophia Cloud or Enterprise to recruit workspace partners, review under_review risk flags, and export VietQR / USDT payout batches.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {isVi ? 'Mạng Lưới CTV Workspace & Chi Trả Dual-Rail (VietQR + USDT)' : 'Workspace Partner Network & Dual-Rail Payouts (VietQR + USDT)'}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isVi
              ? 'Cách ly theo tenant_id của Workspace. CTV bị gắn cờ under_review sẽ tự động giữ tiền chờ bạn duyệt.'
              : 'Isolated by workspace tenant_id. Partners flagged under_review are automatically held back until approved.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowRecruit((v) => !v)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            {isVi ? '+ Thêm CTV' : '+ Recruit Partner'}
          </button>
          <button type="button" onClick={handleExportBatch} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            {isVi ? 'Xuất Lô VietQR + USDT' : 'Export VietQR + USDT Batch'}
          </button>
        </div>
      </div>
      {statusNotice && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
          {statusNotice}
        </div>
      )}
      {showRecruit && (
        <WorkspacePartnerRecruitForm
          isVi={isVi}
          onRecruited={async () => {
            setShowRecruit(false);
            await refreshPartners();
          }}
        />
      )}
      <WorkspacePartnerTable partners={partners} isVi={isVi} onReview={handleReview} />
      {csvPreview && (
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] text-muted-foreground">
          {csvPreview}
        </pre>
      )}
    </div>
  );
}
