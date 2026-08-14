/**
 * Types, constants, and default data for the Admin page.
 * @module components/stitch/screens/admin/admin-page-types
 */

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface KpiData {
  id: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  trendSub?: string;
  /** When present, renders a text label instead of trend arrow (e.g. "Stable") */
  trendLabel?: string;
}

export interface SystemService {
  id: string;
  name: string;
  status: 'healthy' | 'warning';
  latency: string;
}

export interface SignupUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  initials: string;
  avatarAlt?: string;
  tier: string;
  signupDate: string;
  status: 'active' | 'suspended';
}

export interface DeployStatus {
  sha: string;
  env: string;
  ago: string;
}

export interface AdminPageContentProps {
  /** KPI metric cards data */
  kpiMetrics?: KpiData[];
  /** System health services */
  services?: SystemService[];
  /** Recent signup rows */
  signups?: SignupUser[];
  /** Deploy status footer info */
  deployInfo?: DeployStatus;
  /** Page title */
  title?: string;
  /** Badge label next to title */
  badgeLabel?: string;
  /** Navigation tab labels for header */
  headerTabs?: Array<{ id: string; label: string; active?: boolean }>;
  /** Search placeholder */
  searchPlaceholder?: string;
}

/* ── Default data ────────────────────────────────────────────────────────── */

export const DEFAULT_KPI: KpiData[] = [
  { id: 'activeUsers', value: '1,247', trend: '+12.5%', trendDirection: 'up', trendSub: 'vs last month' },
  { id: 'mrr', value: '$12,847', trend: '+8.2%', trendDirection: 'up', trendSub: 'vs last month' },
  { id: 'conversionRate', value: '3.2%', trend: '-0.4%', trendDirection: 'down', trendSub: 'vs last month' },
  { id: 'churnRate', value: '1.8%', trendLabel: 'Stable' },
];

export const DEFAULT_SERVICES: SystemService[] = [
  { id: 'apiGateway', name: 'API Gateway', status: 'healthy', latency: '12ms' },
  { id: 'database', name: 'Database', status: 'healthy', latency: '4ms' },
  { id: 'aiEngine', name: 'AI Engine', status: 'warning', latency: '234ms' },
  { id: 'videoProcessor', name: 'Video Processor', status: 'healthy', latency: '89ms' },
  { id: 'emailService', name: 'Email Service', status: 'healthy', latency: '45ms' },
];

export const DEFAULT_SIGNUPS: SignupUser[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@startup.io',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6PJ5nojf8tvkrNtNJRwaX4wjSXK1Ab1UqD7lygVOgrGUzYR6hr9as7SOQrB_9Vaqg5nVpOCub-6c9nXsFZNcZTL-REIvuA4iKtliQjsKZV5JHE_ope-qzRRbiVFWDa2AooJ20uctaZDF8atRKNROPTiJx2kQLDXcW0zvDxQMd-n4DGa15C6T1jsJMDkMVlANRnGpVGhN_T6nHQUQwFK32bM_0WYpMI7hlxbUIXYOkdmKwMLrlMIZh9v3EyWt-ZE1UQqewGTuPF5c',
    initials: 'SC',
    avatarAlt: 'Product manager in modern office',
    tier: 'PREMIUM',
    signupDate: 'Oct 28, 2023',
    status: 'active',
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    email: 'marcus@agency.com',
    avatar: null,
    initials: 'MJ',
    tier: 'BASIC',
    signupDate: 'Oct 27, 2023',
    status: 'active',
  },
  {
    id: '3',
    name: 'Emily Park',
    email: 'emily@corp.net',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6PJ5nojf8tvkrNtNJRwaX4wjSXK1Ab1UqD7lygVOgrGUzYR6hr9as7SOQrB_9Vaqg5nVpOCub-6c9nXsFZNcZTL-REIvuA4iKtliQjsKZV5JHE_ope-qzRRbiVFWDa2AooJ20uctaZDF8atRKNROPTiJx2kQLDXcW0zvDxQMd-n4DGa15C6T1jsJMDkMVlANRnGpVGhN_T6nHQUQwFK32bM_0WYpMI7hlxbUIXYOkdmKwMLrlMIZh9v3EyWt-ZE1UQqewGTuPF5c',
    initials: 'EP',
    avatarAlt: 'Designer in creative space',
    tier: 'ENTERPRISE',
    signupDate: 'Oct 26, 2023',
    status: 'suspended',
  },
  {
    id: '4',
    name: 'Alex Kim',
    email: 'alex@digital.co',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6PJ5nojf8tvkrNtNJRwaX4wjSXK1Ab1UqD7lygVOgrGUzYR6hr9as7SOQrB_9Vaqg5nVpOCub-6c9nXsFZNcZTL-REIvuA4iKtliQjsKZV5JHE_ope-qzRRbiVFWDa2AooJ20uctaZDF8atRKNROPTiJx2kQLDXcW0zvDxQMd-n4DGa15C6T1jsJMDkMVlANRnGpVGhN_T6nHQUQwFK32bM_0WYpMI7hlxbUIXYOkdmKwMLrlMIZh9v3EyWt-ZE1UQqewGTuPF5c',
    initials: 'AK',
    avatarAlt: 'Creative director in minimal dark grey room',
    tier: 'BASIC',
    signupDate: 'Oct 26, 2023',
    status: 'active',
  },
];

export const DEFAULT_DEPLOY: DeployStatus = {
  sha: 'e7ec20ef7 match',
  env: 'Production',
  ago: '14m ago',
};

export const DEFAULT_TABS = [
  { id: 'overview', label: 'Overview', active: true },
  { id: 'users', label: 'Users' },
  { id: 'systems', label: 'Systems' },
];

/* ── Chart config ────────────────────────────────────────────────────────── */

export const CHART_GRADIENT_ID = 'adminUserGrowthGradient';
export const CHART_LABELS = ['OCT 01', 'OCT 08', 'OCT 15', 'OCT 22', 'OCT 29'];

/* ── Tier badge styles ───────────────────────────────────────────────────── */

export const TIER_BADGE_STYLES: Record<string, string> = {
  MASTER: 'bg-primary/20 text-primary border border-primary/30',
  ENTERPRISE: 'bg-surface-container-highest text-on-surface border border-outline-variant',
  PREMIUM: 'bg-secondary/20 text-secondary border border-secondary/30',
  BASIC: 'bg-outline-variant/20 text-on-surface-variant border border-outline-variant',
};
