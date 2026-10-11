/**
 * Dashboard Activity Table Types
 * Layer: forest/dashboard/activity-table
 */

export interface DashboardActivityItem {
  id: string;
  type?: "mission" | "campaign" | "payment" | string;
  title?: string;
  customer?: string;
  amount?: string;
  status: "completed" | "processing" | "running" | "queued" | "failed" | "paid" | string;
  date: string;
  href?: string;
}

export interface DashboardActivityTableProps {
  activities?: DashboardActivityItem[];
  transactions?: DashboardActivityItem[];
  className?: string;
}
