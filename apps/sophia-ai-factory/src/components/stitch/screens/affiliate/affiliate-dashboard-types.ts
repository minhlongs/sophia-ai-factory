/**
 * Types, constants, and default data for the Affiliate Dashboard page.
 * @module components/stitch/screens/affiliate/affiliate-dashboard-types
 */

import {
  Share2,
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Globe,
  GitBranch,
  Rocket,
} from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface KpiMetric {
  id: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtext?: string;
  subtextColor?: string;
}

export interface Offer {
  id: string;
  name: string;
  description: string;
  commissionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgClass: string;
  iconColorClass: string;
}

export interface ConversionRow {
  id: string;
  product: string;
  amount: string;
  commission: string;
  status: 'pending' | 'approved' | 'paid';
  date: string;
}

export interface AffiliateDashboardPageProps {
  kpiMetrics?: KpiMetric[];
  offers?: Offer[];
  conversions?: ConversionRow[];
  referralLink?: string;
  walletAddress?: string;
  walletBalance?: string;
}

/* ── Constants ───────────────────────────────────────────────────────────── */

export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  paid: 'bg-primary/20 text-primary',
};

export interface SocialPlatform {
  id: string;
  bg: string;
  ariaLabel: string;
  path: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: 'facebook',
    bg: 'bg-[#1877F2]',
    ariaLabel: 'Share on Facebook',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    id: 'twitter',
    bg: 'bg-[#1DA1F2]',
    ariaLabel: 'Share on Twitter',
    path: 'M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z',
  },
  {
    id: 'telegram',
    bg: 'bg-[#0088CC]',
    ariaLabel: 'Share on Telegram',
    path: 'M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.303.48-.429-.012-1.253-.245-1.865-.444-.753-.245-1.353-.375-1.3-.79.029-.215.325-.437.888-.667 3.5-1.523 5.837-2.525 7.013-3.007 3.34-1.37 4.034-1.608 4.487-1.616z',
  },
];

/* ── Default data ────────────────────────────────────────────────────────── */

export const DEFAULT_METRICS: KpiMetric[] = [
  { id: 'totalClicks', value: '12,847', icon: Share2, subtext: '+18.2% this month', subtextColor: 'text-emerald-500' },
  { id: 'conversions', value: '342', icon: UserCheck, subtext: '2.66% CVR', subtextColor: 'text-muted-foreground' },
  { id: 'totalEarned', value: '$4,271', icon: DollarSign, subtext: 'All time', subtextColor: 'text-muted-foreground' },
  { id: 'pending', value: '$892', icon: Clock, subtext: 'Next payout: 3 days', subtextColor: 'text-amber-500' },
  { id: 'activeReferrals', value: '89', icon: Users, subtext: '12 joined this week', subtextColor: 'text-emerald-500' },
];

export const DEFAULT_OFFERS: Offer[] = [
  {
    id: 'sophiaStarter',
    name: 'Sophia Starter',
    description: 'Perfect for solo creators starting their faceless empire.',
    commissionLabel: '20% Recurring',
    icon: Rocket,
    iconBgClass: 'bg-primary',
    iconColorClass: 'text-white',
  },
  {
    id: 'sophiaGrowth',
    name: 'Sophia Growth',
    description: 'Advanced automation for scaling agencies.',
    commissionLabel: '25% Recurring',
    icon: Globe,
    iconBgClass: 'bg-black',
    iconColorClass: 'text-white',
  },
  {
    id: 'accessTrade',
    name: 'AccessTrade Network',
    description: 'E-commerce affiliate bundle',
    commissionLabel: '12% Comm.',
    icon: GitBranch,
    iconBgClass: 'bg-blue-600',
    iconColorClass: 'text-white',
  },
];

export const DEFAULT_CONVERSIONS: ConversionRow[] = [
  { id: '1', product: 'Sophia Starter', amount: '$29.00', commission: '$5.80', status: 'paid', date: '2 min ago' },
  { id: '2', product: 'Sophia Growth', amount: '$79.00', commission: '$19.75', status: 'approved', date: '1 hour ago' },
  { id: '3', product: 'AccessTrade', amount: '$149.00', commission: '$17.88', status: 'pending', date: '3 hours ago' },
];
