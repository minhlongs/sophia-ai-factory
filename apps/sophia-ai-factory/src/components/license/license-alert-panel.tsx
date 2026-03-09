/**
 * License Alert Panel Component
 *
 * Displays active alerts from real-time alert service:
 * - Usage threshold warnings (80%, 90%, 100%)
 * - License expiration warnings
 * - Webhook delivery failures
 * - Quota exceeded notifications
 *
 * Features:
 * - Read/unread status tracking
 * - Dismiss functionality
 * - Severity-based styling
 * - Real-time updates via Supabase Realtime
 *
 * @module components/license/license-alert-panel
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  ShieldAlert,
  WifiOff,
  X,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserAlert {
  id: string;
  type: 'usage_threshold' | 'license_expiring' | 'webhook_delivery_failed' | 'quota_exceeded' | 'payment_failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface AlertPanelProps {
  userId?: string;
  licenseNonce?: string;
  limit?: number;
}

/**
 * Get alert icon
 */
function getAlertIcon(type: string) {
  switch (type) {
    case 'usage_threshold': return TrendingUp;
    case 'license_expiring': return Clock;
    case 'webhook_delivery_failed': return WifiOff;
    case 'quota_exceeded': return ShieldAlert;
    case 'payment_failed': return CreditCard;
    default: return AlertCircle;
  }
}

/**
 * Get severity color
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-destructive text-destructive-foreground';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-yellow-900';
    default: return 'bg-blue-500 text-white';
  }
}

/**
 * Get severity border
 */
function getSeverityBorder(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-destructive';
    case 'high': return 'border-orange-500';
    case 'medium': return 'border-yellow-500';
    default: return 'border-blue-500';
  }
}

/**
 * License Alert Panel
 */
export function LicenseAlertPanel({ userId, licenseNonce, limit = 10 }: AlertPanelProps) {
  const queryClient = useQueryClient();

  // Fetch alerts
  const { data: alertsData, isLoading } = useQuery<{ alerts: UserAlert[]; count: number }>({
    queryKey: ['/api/alerts/history', userId, licenseNonce],
    enabled: !!userId,
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        includeDismissed: 'false',
      });
      if (licenseNonce) params.set('licenseNonce', licenseNonce);

      const response = await fetch(`/api/alerts/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/read`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/unread-count'] });
    },
  });

  // Dismiss alert mutation
  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/dismiss`, {
        method: 'POST',
      });
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
                <Badge variant="destructive" className="ml-2 text-xs">
                  {unreadCount} new
                </Badge>
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
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${getSeverityBorder(alert.severity)} ${
                      alert.read ? 'bg-muted/30' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alert.title}</span>
                            {!alert.read && (
                              <Badge variant="outline" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {alert.type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!alert.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markReadMutation.mutate(alert.id)}
                            disabled={markReadMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissMutation.mutate(alert.id)}
                          disabled={dismissMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default LicenseAlertPanel;
