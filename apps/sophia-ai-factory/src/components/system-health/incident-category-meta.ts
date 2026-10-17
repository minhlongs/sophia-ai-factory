'use client';

/**
 * Incident Category Metadata for CEO-safe Incident UX
 *
 * @module components/system-health/incident-category-meta
 */

import type React from 'react';
import {
  Key,
  Clock,
  CreditCard,
  WifiOff,
  ShieldAlert,
} from 'lucide-react';
import type { IncidentCategory } from '@/land/production-monitoring/customer-health-summary';

export interface IncidentCategoryMetaItem {
  labelEn: string;
  labelVi: string;
  badgeCls: string;
  icon: React.ElementType;
}

export const CATEGORY_META: Record<IncidentCategory, IncidentCategoryMetaItem> = {
  KEY_EXPIRED_OR_INVALID: {
    labelEn: 'Key Expired / Invalid',
    labelVi: 'Khóa hết hạn hoặc không hợp lệ',
    badgeCls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300',
    icon: Key,
  },
  PROVIDER_RATE_LIMIT: {
    labelEn: 'Provider Rate Limit',
    labelVi: 'Giới hạn tốc độ nhà cung cấp',
    badgeCls: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300',
    icon: Clock,
  },
  QUOTA_EXHAUSTED: {
    labelEn: 'Quota / Credit Exhausted',
    labelVi: 'Hết hạn mức hoặc số dư',
    badgeCls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300',
    icon: CreditCard,
  },
  NETWORK_TIMEOUT: {
    labelEn: 'Network Timeout',
    labelVi: 'Hết thời gian chờ mạng',
    badgeCls: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300',
    icon: WifiOff,
  },
  ASSET_VALIDATION_FAILED: {
    labelEn: 'Asset Validation Rejected',
    labelVi: 'Tài nguyên bị từ chối kiểm duyệt',
    badgeCls: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300',
    icon: ShieldAlert,
  },
};
