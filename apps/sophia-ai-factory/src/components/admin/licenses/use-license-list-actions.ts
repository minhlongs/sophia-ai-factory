'use client';

/**
 * use-license-list-actions hook
 * Data fetching + revoke/reactivate/extend actions for LicenseList
 */

import { useState, useEffect } from 'react';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import type { LicenseSummary, LicenseListResponse } from '@/lib/raas-schema';

export interface License {
  id: string;
  tier: string;
  createdAt: number;
  expiresAt: number | null;
  isRevoked: boolean;
  revokedAt?: number;
  validateCount: number;
  customerEmail?: string;
}

export const LIMIT = 20;

interface UseLicenseListActionsProps {
  onRevoke?: (id: string, reason?: string) => void;
  onExtend?: (id: string, days: number) => void;
}

interface ActionErrorResponse {
  error?: string;
}

export function useLicenseListActions({ onRevoke, onExtend }: UseLicenseListActionsProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string | undefined>();
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: LIMIT.toString(),
        ...(tierFilter !== 'all' && { tier: tierFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(search && { search }),
      });

      const response = await fetch(`/api/admin/licenses?${params}`);
      const data = (await response.json()) as LicenseListResponse;

      if (response.ok) {
        const licensesWithEmail = data.licenses.map((lic: LicenseSummary) => ({
          ...lic,
          customerEmail: (lic.metadata as { customer_email?: string })?.customer_email,
        }));
        setLicenses(licensesWithEmail);
        setTotal(data.total);
      }
    } catch (error) {
      logger.error('Failed to fetch licenses', toError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLicenses(); }, [page, tierFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchLicenses(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRevoke = async (id: string, reason?: string) => {
    try {
      const response = await fetch(`/api/admin/licenses/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (response.ok) {
        await fetchLicenses();
        onRevoke?.(id, reason);
        setRevokeDialogOpen(false);
      } else {
        const data = (await response.json()) as ActionErrorResponse;
        alert(`Failed to revoke: ${data.error}`);
      }
    } catch (error) {
      logger.error('Failed to revoke license', toError(error));
    }
  };

  const handleReactivate = async (id: string) => {
    if (!confirm(`Are you sure you want to reactivate license ${id}?`)) return;
    try {
      const response = await fetch(`/api/admin/licenses/${id}/reactivate`, { method: 'POST' });
      if (response.ok) {
        await fetchLicenses();
      } else {
        const data = (await response.json()) as ActionErrorResponse;
        alert(`Failed to reactivate: ${data.error}`);
      }
    } catch (error) {
      logger.error('Failed to reactivate license', toError(error));
    }
  };

  const handleExtendComplete = async (id: string, days: number) => {
    try {
      const response = await fetch(`/api/admin/licenses/${id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      if (response.ok) {
        await fetchLicenses();
        setExtendDialogOpen(false);
        setSelectedLicenseId(undefined);
        onExtend?.(id, days);
      } else {
        const data = (await response.json()) as ActionErrorResponse;
        alert(`Failed to extend: ${data.error}`);
      }
    } catch (error) {
      logger.error('Failed to extend license', toError(error));
    }
  };

  return {
    licenses, loading, search, tierFilter, statusFilter, page, total,
    selectedLicenseId, regenerateDialogOpen, revokeDialogOpen, extendDialogOpen,
    setSearch, setTierFilter, setStatusFilter, setPage,
    setSelectedLicenseId, setRegenerateDialogOpen, setRevokeDialogOpen, setExtendDialogOpen,
    fetchLicenses, handleRevoke, handleReactivate, handleExtendComplete,
  };
}
