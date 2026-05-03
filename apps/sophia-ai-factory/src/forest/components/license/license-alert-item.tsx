'use client';

/**
 * LicenseAlertItem — single alert row rendering with icon, severity, and actions
 */

import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import {
  AlertCircle, CheckCircle2, Clock, ShieldAlert, WifiOff, TrendingUp, CreditCard, X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface UserAlert {
  id: string;
  type: 'usage_threshold' | 'license_expiring' | 'webhook_delivery_failed' | 'quota_exceeded' | 'payment_failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

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

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-destructive text-destructive-foreground';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-yellow-900';
    default: return 'bg-blue-500 text-white';
  }
}

function getSeverityBorder(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-destructive';
    case 'high': return 'border-orange-500';
    case 'medium': return 'border-yellow-500';
    default: return 'border-blue-500';
  }
}

interface LicenseAlertItemProps {
  alert: UserAlert;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  markReadPending: boolean;
  dismissPending: boolean;
}

export function LicenseAlertItem({
  alert, onMarkRead, onDismiss, markReadPending, dismissPending,
}: LicenseAlertItemProps) {
  const Icon = getAlertIcon(alert.type);

  return (
    <div
      className={`p-4 rounded-lg border ${getSeverityBorder(alert.severity)} ${
        alert.read ? 'bg-muted/30' : 'bg-muted/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{alert.title}</span>
              {!alert.read && (
                <Badge variant="outline" className="text-xs">New</Badge>
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
              onClick={() => onMarkRead(alert.id)}
              disabled={markReadPending}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(alert.id)}
            disabled={dismissPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

