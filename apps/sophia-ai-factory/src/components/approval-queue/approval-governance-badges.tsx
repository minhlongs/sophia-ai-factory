// i18n-namespace: approvals
import React from 'react';
import { Globe2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Approval } from './types';

interface ApprovalGovernanceBadgesProps {
  approval: Approval;
}

export function ApprovalGovernanceBadges({ approval }: ApprovalGovernanceBadgesProps) {
  const t = useTranslations('approvals');
  const isCrypto = approval.niche === 'crypto_global' || approval.actionSummary.toLowerCase().includes('crypto') || approval.actionSummary.toLowerCase().includes('cex');
  const isSaas = approval.niche === 'saas_global' || approval.actionSummary.toLowerCase().includes('saas');
  const jurisdiction = approval.jurisdiction || 'GLOBAL';
  // This badge is only meaningful while the compliance guard actually ran, so it
  // reflects verified server state instead of being shown on every card.
  const complianceVerified = approval.complianceStatus === 'passed';

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
        {isCrypto ? '⚡ Crypto/CEX (Affiliate)' : isSaas ? '💻 Global SaaS (MRR)' : '🏢 OPC Campaign'}
      </span>

      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] border border-border">
        <Globe2 className="h-3 w-3 text-slate-500" />
        {jurisdiction}
      </span>

      {complianceVerified && (
        <span
          data-testid="approval-compliance-verified"
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
        >
          {t('badges.complianceVerified')}
        </span>
      )}

      {approval.approvalPayloadHash && (
        <span
          data-testid="approval-payload-hash"
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground border border-border"
          title={t('badges.payloadHashHint')}
        >
          {t('badges.changeNeedsApproval')}
        </span>
      )}
    </div>
  );
}
