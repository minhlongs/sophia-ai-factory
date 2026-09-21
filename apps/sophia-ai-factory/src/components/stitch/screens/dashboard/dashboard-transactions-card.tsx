'use client';

/**
 * Stitch Dashboard Transactions Card (Backward compatibility wrapper)
 */
export type { DashboardActivityItem as DashboardTransactionItem } from '@/forest/dashboard/dashboard-activity-table';
export {
  DashboardActivityTable as DashboardTransactionsCard,
  DashboardActivityTable as default,
} from '@/forest/dashboard/dashboard-activity-table';
