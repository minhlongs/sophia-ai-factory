'use client';
/**
 * License Alert Panel Component
 * Alert item rendering extracted to license-alert-item.tsx
 *
 * @module components/license/license-alert-panel
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Bell } from 'lucide-react';
import { LicenseAlertItem } from './license-alert-item';
import type { AlertPanelProps } from './license-alert-hooks';
import { useLicenseAlerts } from './license-alert-hooks';

export function LicenseAlertPanel({ userId, licenseNonce, limit = 10 }: AlertPanelProps) {
  const {
    alerts,
    unreadCount,
    isLoading,
    markReadMutation,
    dismissMutation,
  } = useLicenseAlerts(userId, licenseNonce, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="motion-safe:animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded motion-safe:animate-pulse" />
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