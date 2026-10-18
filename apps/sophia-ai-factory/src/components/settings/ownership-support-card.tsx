'use client';

import React from 'react';
import { ShieldCheck, Clock, LifeBuoy } from 'lucide-react';
import type { AccountOwnershipDetails } from '@/land/account/ownership-management';

export interface OwnershipSupportCardProps {
  details: AccountOwnershipDetails | null;
  supportLoading: boolean;
  onToggleSupport: () => void;
}

export function OwnershipSupportCard({
  details,
  supportLoading,
  onToggleSupport,
}: OwnershipSupportCardProps) {
  return (
    <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 shadow-sm border border-border dark:border-white/[0.08]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border dark:border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold text-foreground dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {details?.orgName || 'Workspace'}
            </h3>
            {details?.isOwner && (
              <span className="bg-primary/15 text-primary border border-primary/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Organization Owner
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">ID: {details?.orgId}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSupport}
            disabled={supportLoading || !details?.isOwner}
            className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 border ${
              details?.supportAccess.enabled
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-background dark:bg-[#090A10] hover:bg-muted text-foreground dark:text-white border-border dark:border-white/[0.08]'
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            {details?.supportAccess.enabled ? 'Revoke Support Access' : 'Allow Sophia Support (24h)'}
          </button>
        </div>
      </div>

      {details?.supportAccess.enabled && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-700 dark:text-amber-200 flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Support access granted until{' '}
            {details.supportAccess.expiresAt
              ? new Date(details.supportAccess.expiresAt).toLocaleString()
              : '24 hours'}
            .
          </span>
        </div>
      )}
    </section>
  );
}
