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

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    setDomainError(null);
    setDomainSuccess(null);
    if (!actions?.verifyCustomDomainStatus) {
      setDomainError(t('errors.verifyFailed'));
      setVerifyingDomainId(null);
      return;
    }
    const res = await actions.verifyCustomDomainStatus(orgId, domainId);
    setVerifyingDomainId(null);
    if (res.ok) {
      setDomains((prev) =>
        prev.map((d) =>
          d.id === domainId
            ? {
                ...d,
                ssl_status: res.value.sslStatus,
                verification_status: res.value.verificationStatus,
                cname_verified: res.value.cnameVerified,
                active: res.value.active,
                ownership_verification: res.value.ownershipVerification ?? null,
                ssl_verification: res.value.sslVerification ?? null,
              }
            : d,
        ),
      );
      setDomainSuccess(t('domains.alerts.verifiedSuccess'));
    } else {
      setDomainError(res.error.message || t('errors.verifyFailed'));
    }
  };

  const handleDeleteDomain = async (domainId: string, hostname: string) => {
    if (!confirm(t('domains.actions.confirmDelete', { hostname }))) return;
    setDeletingDomainId(domainId);
    setDomainError(null);
    setDomainSuccess(null);
    if (!actions?.deleteCustomDomain) {
      setDomainError(t('errors.deleteFailed'));
      setDeletingDomainId(null);
      return;
    }
    const res = await actions.deleteCustomDomain(orgId, domainId);
    setDeletingDomainId(null);
    if (res.ok) {
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      setDomainSuccess(t('domains.alerts.deletedSuccess'));
    } else {
      setDomainError(res.error.message || t('errors.deleteFailed'));
    }
  };

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
