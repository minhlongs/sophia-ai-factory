/**
 * Types, constants, and default data for the Campaigns page.
 * @module components/stitch/screens/campaigns/campaigns-page-types
 */

import { MonitorPlay, Camera, Video } from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────────────── */

export type CampaignStatus = 'live' | 'paused' | 'draft' | 'done';
export type Channel = 'youtube' | 'instagram' | 'tiktok';

export interface CampaignMetric {
  views: string;
  revenue: string;
  ctr: string;
}

export interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  channel: string;
  channels: Channel[];
  thumbnail: string | null;
  metrics: CampaignMetric;
  progress: number;
  progressLabel: string;
  lastPublished: string;
  action: string;
  actionLabel: string;
}

export interface CampaignsPageProps {
  /** Pre-populated campaigns list (SSR data) */
  initialCampaigns?: Campaign[];
  /** Total number of campaigns for pagination */
  totalCampaigns?: number;
  /** Items per page */
  itemsPerPage?: number;
  /** Current search query (initial) */
  initialSearchQuery?: string;
  /** Callback when creating a new campaign */
  onCreateCampaign?: () => void;
  /** Callback when searching */
  onSearch?: (query: string) => void;
  /** Callback when changing page */
  onPageChange?: (page: number) => void;
}

/* ── Constants ───────────────────────────────────────────────────────────── */

export const STATUS_CONFIG: Record<CampaignStatus, { color: 'success' | 'warning' | 'neutral'; labelKey: string }> = {
  live: { color: 'success', labelKey: 'status.live' },
  paused: { color: 'warning', labelKey: 'status.paused' },
  draft: { color: 'neutral', labelKey: 'status.draft' },
  done: { color: 'neutral', labelKey: 'status.done' },
};

export const CHANNEL_ICONS: Record<Channel, React.ComponentType<{ className?: string; 'aria-label'?: string }>> = {
  youtube: MonitorPlay,
  instagram: Camera,
  tiktok: Video,
};

/* ── Default sample data (UI demo / fallback) ────────────────────────────── */

export const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    title: 'Summer Vibes 2024',
    status: 'live',
    channel: 'Faceless YouTube',
    channels: ['youtube', 'instagram'],
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCeeqj2_4rdboxlKLaptaCp9MgzO8yqCHoPT3Aj3gcKgw9tAqTikqrPdO0RNtsBV4ioO3iReI9DhE0JY5b-0nNQ67MoIDq3H9WtD7kX71BaV4E_EZJNU2w0TtvgFbYxuVB8mRinsGVgrRpc48aWmgOWAPWUfMnriPM8qRaEDtjspkGPvWW9FMZ83nLMCtRMth6Vrvc2fVMyJ50vJXhFBr9ubU5uZaEPvp6JDaDFUJ_7xNgaOSO3hMaaUUffclhrPOaxO5xw4m-MGzQ',
    metrics: { views: '12.4K', revenue: '$847', ctr: '3.2%' },
    progress: 85,
    progressLabel: 'Campaign Progress',
    lastPublished: '2 hours ago',
    action: 'View Details',
    actionLabel: 'viewDetails',
  },
  {
    id: '2',
    title: 'Tech Review Weekly',
    status: 'paused',
    channel: 'Affiliate',
    channels: ['youtube'],
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYc0D1h8L2M36gkDF4kdzlnmYVwazXfIVC4c1iIS93URw1wCftVWuWUth76X4FibQSS3AaykhyGrq6JG1aShpGe514TpKUR9EHaVHwyji0LlaBaCWsa3u89iV7bF8zanUBDI_zLWEEVicsIrdZa9mXxSt41yoxPUJmYnJHsjFsWgNHMT3GGHb1PFaocmhLX2q7EWgZlcIviUx4uxTVXdnF2wpQfwZW0wHygerdjVwrD1318oscUsxjUIJcI5Hy-bIy24acloMegvE',
    metrics: { views: '4.1K', revenue: '$212', ctr: '1.8%' },
    progress: 40,
    progressLabel: 'Campaign Progress',
    lastPublished: '1 day ago',
    action: 'View Details',
    actionLabel: 'viewDetails',
  },
  {
    id: '3',
    title: 'Daily Stoicism',
    status: 'draft',
    channel: 'Motivational',
    channels: [],
    thumbnail: null,
    metrics: { views: '-', revenue: '-', ctr: '-' },
    progress: 12,
    progressLabel: 'Generation Progress',
    lastPublished: '3 hours ago',
    action: 'Continue Draft',
    actionLabel: 'continueDraft',
  },
  {
    id: '4',
    title: 'ASMR Cooking Series',
    status: 'done',
    channel: 'Lifestyle',
    channels: [],
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbemvJKIApLiEyXcFKMCvpAbVUeDznfH-HrRLwAAfawt94f0_jXPQAQN53oJMpUnWDr0MfHasjLaiUlfVbFF6aDk96k5uLA-EG9vqqmameDRiiOuDorzmsUn7W4ZjZk46yRb3HKpx6TONAe5x_BQ3X-NkuiLzgeJ--7ofnWAXNsz_UauI6b49Ei5b10m-2jh7Sq2VUV8BlD61U1jNQzN90kWbLkbd_HjgMgeLRoqVLmEJrgeYfc4CfXcmzINy8oSO3BBuUMe4-eWA',
    metrics: { views: '82K', revenue: '$1.2K', ctr: '5.1%' },
    progress: 100,
    progressLabel: 'Campaign Progress',
    lastPublished: '5 hours ago',
    action: 'View Details',
    actionLabel: 'viewDetails',
  },
];
