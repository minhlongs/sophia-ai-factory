/**
 * White-Label Manager Domains Tab.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/domains-tab
 */

import React from 'react';
import { Globe } from 'lucide-react';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import { DomainAddCard } from './domain-add-card';
import { DomainItemCard } from './domain-item-card';

interface DomainsTabProps {
  domains: CustomDomainRecord[];
  newHostname: string;
  setNewHostname: (value: string) => void;
  isAddingDomain: boolean;
  domainError: string | null;
  domainSuccess: string | null;
  onAddDomain: (e: React.FormEvent) => Promise<void>;
  verifyingDomainId: string | null;
  deletingDomainId: string | null;
  copiedKey: string | null;
  onVerifyDomain: (id: string) => Promise<void>;
  onDeleteDomain: (id: string, hostname: string) => Promise<void>;
  onCopy: (key: string, text: string) => void;
  labels: {
    add: {
      addButton: string;
      description: string;
      inputPlaceholder: string;
      adding: string;
    };
    list: {
      title: string;
      emptyTitle: string;
      emptyDescription: string;
    };
    status: Record<'active' | 'pendingValidation' | 'pendingDeployment' | 'error' | 'verified' | 'pending', string>;
    actions: Record<'verifying' | 'verify' | 'deleting' | 'delete', string>;
    dnsInstructions: Record<'title' | 'cnameHost' | 'cnameTarget', string>;
  };
}

export function DomainsTab({
  domains,
  newHostname,
  setNewHostname,
  isAddingDomain,
  domainError,
  domainSuccess,
  onAddDomain,
  verifyingDomainId,
  deletingDomainId,
  copiedKey,
  onVerifyDomain,
  onDeleteDomain,
  onCopy,
  labels,
}: DomainsTabProps) {
  return (
    <div className="space-y-6">
      <DomainAddCard
        newHostname={newHostname}
        setNewHostname={setNewHostname}
        isAddingDomain={isAddingDomain}
        domainError={domainError}
        domainSuccess={domainSuccess}
        onAddDomain={onAddDomain}
        labels={labels.add}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">{labels.list.title}</h2>
        {domains.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-2xl p-12 text-center">
            <Globe className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-zinc-300">{labels.list.emptyTitle}</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">{labels.list.emptyDescription}</p>
          </div>
        ) : (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 overflow-hidden shadow-xl">
            {domains.map((dom) => (
              <DomainItemCard
                key={dom.id}
                dom={dom}
                verifyingDomainId={verifyingDomainId}
                deletingDomainId={deletingDomainId}
                copiedKey={copiedKey}
                onVerifyDomain={onVerifyDomain}
                onDeleteDomain={onDeleteDomain}
                onCopy={onCopy}
                labels={{
                  status: labels.status,
                  actions: labels.actions,
                  dnsInstructions: labels.dnsInstructions,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
