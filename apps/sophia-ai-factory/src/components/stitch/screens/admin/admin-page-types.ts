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

/**
 * Zero-mock admin baseline KPI statistics.
 * Authentic initial state for fresh or live production tenants.
 */
export const DEFAULT_KPI: KpiData[] = [
  { id: 'activeUsers', value: '0', trend: '0%', trendDirection: 'up', trendSub: 'vs last month' },
  { id: 'mrr', value: '$0', trend: '0%', trendDirection: 'up', trendSub: 'vs last month' },
  { id: 'conversionRate', value: '0.0%', trend: '0.0%', trendDirection: 'up', trendSub: 'vs last month' },
  { id: 'churnRate', value: '0.0%', trendLabel: 'Optimal' },
];

/**
 * Authentic Sophia AI Factory Core Architecture Services.
 * Reflects actual Cloudflare Workers edge, D1, OpenClaw, HeyGen, and R2.
 */
export const DEFAULT_SERVICES: SystemService[] = [
  { id: 'apiGateway', name: 'Edge Worker (API Gateway)', status: 'healthy', latency: 'Active' },
  { id: 'database', name: 'Cloudflare D1 SQLite', status: 'healthy', latency: 'Active' },
  { id: 'aiEngine', name: 'OpenClaw PEV Engine', status: 'healthy', latency: 'Ready' },
  { id: 'videoProcessor', name: 'Video Generation Service', status: 'healthy', latency: 'Ready' },
  { id: 'storage', name: 'Cloudflare R2 Object Storage', status: 'healthy', latency: 'Active' },
];

/**
 * Zero-mock recent signups. Empty by default.
 */
export const DEFAULT_SIGNUPS: SignupUser[] = [];

/**
 * Neutral deploy status default.
 */
export const DEFAULT_DEPLOY: DeployStatus = {
  sha: 'HEAD',
  env: 'Production',
  ago: 'Live edge',
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
