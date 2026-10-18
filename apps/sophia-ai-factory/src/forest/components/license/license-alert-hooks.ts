'use client';

/**
 * Hooks for LicenseAlertPanel component.
 * Layer: forest/components/license
 * @module forest/components/license/license-alert-hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import type { UserAlert } from './license-alert-item';

export interface AlertPanelProps {
  userId?: string;
  licenseNonce?: string;
  limit?: number;
}

export function useLicenseAlerts(userId?: string, licenseNonce?: string, limit = 10) {
  const csrfHeaders = useCsrfToken();

  const { data: alertsData, isLoading } = useQuery<{ alerts: UserAlert[]; count: number }>({
    queryKey: ['/api/alerts/history', userId, licenseNonce],
    enabled: !!userId,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString(), includeDismissed: 'false' });
      if (licenseNonce) params.set('licenseNonce', licenseNonce);
      const response = await fetch(`/api/alerts/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
  });

  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/read`, { method: 'POST', headers: { ...csrfHeaders } });
      if (!response.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/unread-count'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/dismiss`, { method: 'POST', headers: { ...csrfHeaders } });
      if (!response.ok) throw new Error('Failed to dismiss alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/history'] });
    },
  });

  const alerts = alertsData?.alerts || [];
  const unreadCount = alerts.filter((a) => !a.read).length;

  return {
    alerts,
    unreadCount,
    isLoading,
    markReadMutation,
    dismissMutation,
  };
}