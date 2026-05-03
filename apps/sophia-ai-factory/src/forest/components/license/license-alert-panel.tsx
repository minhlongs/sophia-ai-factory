/**
 * License Alert Panel Component
 * Alert item rendering extracted to license-alert-item.tsx
 *
 * @module components/license/license-alert-panel
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Bell } from 'lucide-react';
import { LicenseAlertItem } from './license-alert-item';
import type { UserAlert } from './license-alert-item';
import { useCsrfToken } from '@/seed/security/use-csrf-token';

interface AlertPanelProps {
  userId?: string;
  licenseNonce?: string;
  limit?: number;
}

export function LicenseAlertPanel({ userId, licenseNonce, limit = 10 }: AlertPanelProps) {
  const queryClient = useQueryClient();
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alerts
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">{unreadCount} new</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
              {alerts.length === 0 && ' - All caught up!'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active alerts</p>
          </div>
        ) : (
          <div className="h-[400px] overflow-y-auto pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <LicenseAlertItem
                  key={alert.id}
                  alert={alert}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  onDismiss={(id) => dismissMutation.mutate(id)}
                  markReadPending={markReadMutation.isPending}
                  dismissPending={dismissMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LicenseAlertPanel;
