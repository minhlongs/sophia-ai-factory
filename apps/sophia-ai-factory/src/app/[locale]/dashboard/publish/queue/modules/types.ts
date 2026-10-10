import React from 'react';
import { Clock, CheckCircle, XCircle, Shield } from 'lucide-react';

export interface PublishJob {
  id: string;
  videoId: string;
  videoTitle: string;
  templateId: number;
  templateName: string;
  target: string;
  status: 'pending' | 'scheduled' | 'sent' | 'failed' | 'pending_approval';
  createdAt: number;
  sentAt?: number;
  errorMessage?: string;
}

export const STATUS_CONFIG: Record<PublishJob['status'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pending: {
    label: 'Pending',
    icon: React.createElement(Clock, { className: 'w-4 h-4' }),
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
  },
  scheduled: {
    label: 'Scheduled',
    icon: React.createElement(Clock, { className: 'w-4 h-4' }),
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  sent: {
    label: 'Sent',
    icon: React.createElement(CheckCircle, { className: 'w-4 h-4' }),
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
  },
  failed: {
    label: 'Failed',
    icon: React.createElement(XCircle, { className: 'w-4 h-4' }),
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
  pending_approval: {
    label: 'Approval Needed',
    icon: React.createElement(Shield, { className: 'w-4 h-4' }),
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
};
