/**
 * White-Label Manager Domain Item Card.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/domain-item-card
 */

import React from 'react';
import {
  ExternalLink,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import { DnsRecordsTable } from './dns-records-table';

interface DomainItemCardProps {
  dom: CustomDomainRecord;
  verifyingDomainId: string | null;
  deletingDomainId: string | null;
  copiedKey: string | null;
  onVerifyDomain: (id: string) => Promise<void>;
  onDeleteDomain: (id: string, hostname: string) => Promise<void>;
  onCopy: (key: string, text: string) => void;
  labels: {
    status: Record<'active' | 'pendingValidation' | 'pendingDeployment' | 'error' | 'verified' | 'pending', string>;
    actions: Record<'verifying' | 'verify' | 'deleting' | 'delete', string>;
    dnsInstructions: Record<'title' | 'cnameHost' | 'cnameTarget', string>;
  };
}

export function DomainItemCard({
  dom,
  verifyingDomainId,
  deletingDomainId,
  copiedKey,
  onVerifyDomain,
  onDeleteDomain,
  onCopy,
  labels,
}: DomainItemCardProps) {
  const isSslActive = dom.ssl_status === 'active';
  const isVerified = dom.verification_status === 'verified' || dom.verification_status === 'active';

  const sslBadgeClass = isSslActive
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : dom.ssl_status === 'error'
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  const sslLabel = isSslActive
    ? labels.status.active
    : dom.ssl_status === 'pending_validation'
      ? labels.status.pendingValidation
      : dom.ssl_status === 'pending_deployment'
        ? labels.status.pendingDeployment
        : labels.status.error;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-white tracking-wide">{dom.hostname}</span>
            <a href={`https://${dom.hostname}`} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${sslBadgeClass}`}>
              {isSslActive ? <ShieldCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {sslLabel}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${isVerified ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
              {isVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {isVerified ? labels.status.verified : labels.status.pending}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onVerifyDomain(dom.id)}
            disabled={verifyingDomainId === dom.id}
            className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifyingDomainId === dom.id ? 'animate-spin' : ''}`} />
            {verifyingDomainId === dom.id ? labels.actions.verifying : labels.actions.verify}
          </button>
          <button
            type="button"
            onClick={() => onDeleteDomain(dom.id, dom.hostname)}
            disabled={deletingDomainId === dom.id}
            className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deletingDomainId === dom.id ? labels.actions.deleting : labels.actions.delete}
          </button>
        </div>
      </div>

      <DnsRecordsTable
        dom={dom}
        copiedKey={copiedKey}
        onCopy={onCopy}
        title={labels.dnsInstructions.title}
        cnameHost={labels.dnsInstructions.cnameHost}
        cnameTarget={labels.dnsInstructions.cnameTarget}
      />
    </div>
  );
}
