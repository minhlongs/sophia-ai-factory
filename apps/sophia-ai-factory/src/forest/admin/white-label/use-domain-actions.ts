// i18n-namespace: whiteLabel
/**
 * White-Label Manager Domain State & Actions Hook.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/use-domain-actions
 */

import { useState } from 'react';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import type { WhiteLabelManagerActions } from './types';
import {
  verifyCustomDomainById,
  deleteCustomDomainById,
} from './domain-action-handlers';

interface UseDomainActionsProps {
  orgId: string;
  initialDomains: CustomDomainRecord[];
  actions?: WhiteLabelManagerActions;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function useDomainActions({
  orgId,
  initialDomains,
  actions,
  t,
}: UseDomainActionsProps) {
  const [domains, setDomains] = useState<CustomDomainRecord[]>(initialDomains);
  const [newHostname, setNewHostname] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostname.trim()) {
      setDomainError(t('errors.domainRequired'));
      return;
    }
    setDomainError(null);
    setDomainSuccess(null);
    setIsAddingDomain(true);
    try {
      if (!actions?.registerCustomDomain) {
        setDomainError(t('errors.domainRequired'));
        return;
      }
      const res = await actions.registerCustomDomain(orgId, newHostname.trim());
      if (res.ok) {
        setDomains((prev) => [res.value, ...prev]);
        setDomainSuccess(t('domains.alerts.registeredSuccess', { hostname: res.value.hostname }));
        setNewHostname('');
      } else {
        setDomainError(res.error.message || t('errors.domainRequired'));
      }
    } finally {
      setIsAddingDomain(false);
    }
  };

  const actionCtx = {
    orgId,
    actions,
    t,
    setDomains,
    setDomainError,
    setDomainSuccess,
  };

  const handleVerifyDomain = (domainId: string) =>
    verifyCustomDomainById(actionCtx, domainId, setVerifyingDomainId);

  const handleDeleteDomain = (domainId: string, hostname: string) =>
    deleteCustomDomainById(actionCtx, domainId, hostname, setDeletingDomainId);

  return {
    domains,
    newHostname,
    setNewHostname,
    domainError,
    domainSuccess,
    isAddingDomain,
    verifyingDomainId,
    deletingDomainId,
    copiedKey,
    handleCopy,
    handleAddDomain,
    handleVerifyDomain,
    handleDeleteDomain,
  };
}
