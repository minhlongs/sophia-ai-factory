/**
 * Domain action handlers for White-Label Manager.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/domain-action-handlers
 */

// i18n-namespace: whiteLabel

import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import type { WhiteLabelManagerActions } from './types';

export interface DomainActionContext {
  orgId: string;
  actions?: WhiteLabelManagerActions;
  t: (key: string, values?: Record<string, string | number>) => string;
  setDomains: React.Dispatch<React.SetStateAction<CustomDomainRecord[]>>;
  setDomainError: (err: string | null) => void;
  setDomainSuccess: (msg: string | null) => void;
}

export async function verifyCustomDomainById(
  ctx: DomainActionContext,
  domainId: string,
  setVerifyingDomainId: (id: string | null) => void,
): Promise<void> {
  const { orgId, actions, t, setDomains, setDomainError, setDomainSuccess } = ctx;
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
}

export async function deleteCustomDomainById(
  ctx: DomainActionContext,
  domainId: string,
  hostname: string,
  setDeletingDomainId: (id: string | null) => void,
): Promise<void> {
  const { orgId, actions, t, setDomains, setDomainError, setDomainSuccess } = ctx;
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
}
