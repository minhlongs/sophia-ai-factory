"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import { Badge } from "@/seed/components/ui/badge";
import { Button } from "@/seed/components/ui/button";
import { Input } from "@/seed/components/ui/input";
import {
  Search,
  Plus,
  Eye,
  DollarSign,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  Megaphone,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

type CampaignStatus = "active" | "paused" | "draft" | "completed";
type Channel = "youtube" | "tiktok" | "instagram" | "facebook";

interface CampaignCardData {
  id: string;
  name: string;
  status: CampaignStatus;
  niche: string;
  channels: Channel[];
  views: string;
  revenue: string;
  ctr: string;
  updatedAt: string;
}

interface FilterState {
  search: string;
  status: CampaignStatus | "all";
  channel: Channel | "all";
  dateRange: string;
}

// ─── Status Configuration ─────────────────────────────────────────

const statusConfig: Record<
  CampaignStatus,
  { variant: "basic" | "secondary" | "outline" | "default" | "premium" | "enterprise" | "destructive"; label: string }
> = {
  active: { variant: "basic", label: "Active" },
  paused: { variant: "secondary", label: "Paused" },
  draft: { variant: "outline", label: "Draft" },
  completed: { variant: "default", label: "Completed" },
};

const channelLabels: Record<Channel, string> = {
  youtube: "YT",
  tiktok: "TT",
  instagram: "IG",
  facebook: "FB",
};

// ─── Mock Data ────────────────────────────────────────────────────

const mockCampaigns: CampaignCardData[] = [
  { id: "1", name: "Summer Sale 2026", status: "active", niche: "ecommerce", channels: ["youtube", "tiktok"], views: "124.5K", revenue: "$4,280", ctr: "3.2%", updatedAt: "2h ago" },
  { id: "2", name: "Product Launch Q3", status: "active", niche: "saas", channels: ["youtube", "instagram", "facebook"], views: "89.2K", revenue: "$3,150", ctr: "4.1%", updatedAt: "5h ago" },
  { id: "3", name: "Brand Awareness", status: "paused", niche: "branding", channels: ["youtube", "facebook"], views: "245.1K", revenue: "$8,920", ctr: "2.8%", updatedAt: "1d ago" },
  { id: "4", name: "Holiday Campaign", status: "completed", niche: "seasonal", channels: ["youtube", "tiktok", "instagram"], views: "512.8K", revenue: "$18,430", ctr: "5.0%", updatedAt: "3d ago" },
  { id: "5", name: "Flash Sale May", status: "completed", niche: "ecommerce", channels: ["tiktok", "instagram"], views: "98.4K", revenue: "$2,670", ctr: "2.5%", updatedAt: "1w ago" },
  { id: "6", name: "Influencer Collab", status: "draft", niche: "influencer", channels: ["instagram", "youtube"], views: "0", revenue: "$0", ctr: "0%", updatedAt: "Just now" },
  { id: "7", name: "Retargeting Q3", status: "active", niche: "ecommerce", channels: ["facebook", "youtube"], views: "67.3K", revenue: "$2,140", ctr: "3.8%", updatedAt: "8h ago" },
  { id: "8", name: "New Year Campaign", status: "draft", niche: "seasonal", channels: ["youtube", "tiktok", "facebook"], views: "0", revenue: "$0", ctr: "0%", updatedAt: "2d ago" },
];

const CARDS_PER_PAGE = 6;

// ─── Filter Bar ───────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const t = useTranslations("campaigns");

  const statusOptions: { value: CampaignStatus | "all"; label: string }[] = [
    { value: "all", label: t("all_statuses") || "All Statuses" },
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "draft", label: "Draft" },
    { value: "completed", label: "Completed" },
  ];

  const channelOptions: { value: Channel | "all"; label: string }[] = [
    { value: "all", label: t("all_channels") || "All Channels" },
    { value: "youtube", label: "YouTube" },
    { value: "tiktok", label: "TikTok" },
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
  ];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1" role="search">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600"
          aria-hidden="true"
        />
        <Input
          placeholder={t("search_campaigns") || "Search campaigns..."}
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="border-zinc-700 bg-zinc-800 pl-9 text-white placeholder:text-zinc-600"
        />
      </div>

      {/* Status Dropdown */}
      <select
        value={filters.status}
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value as CampaignStatus | "all" })
        }
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        aria-label={t("filter_status") || "Filter by status"}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Channel Dropdown */}
      <select
        value={filters.channel}
        onChange={(e) =>
          onChange({ ...filters, channel: e.target.value as Channel | "all" })
        }
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        aria-label={t("filter_channel") || "Filter by channel"}
      >
        {channelOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Date Range */}
      <Input
        type="date"
        value={filters.dateRange}
        onChange={(e) => onChange({ ...filters, dateRange: e.target.value })}
        className="w-full border-zinc-700 bg-zinc-800 text-white sm:w-auto"
        aria-label={t("filter_date") || "Filter by date"}
      />
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: CampaignCardData }) {
  const status = statusConfig[campaign.status];

  return (
    <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-indigo-500/30">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-sm font-medium text-white line-clamp-1">{campaign.name}</h3>
        <Badge variant={status.variant} className="ml-2 shrink-0 text-xs capitalize">
          {status.label}
        </Badge>
      </div>

      {/* Niche */}
      <div className="mb-3">
        <span className="inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          #{campaign.niche}
        </span>
      </div>

      {/* Channel Icons */}
      <div className="mb-4 flex items-center gap-1.5">
        {campaign.channels.map((ch) => (
          <span
            key={ch}
            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
          >
            {channelLabels[ch]}
          </span>
        ))}
      </div>

      {/* Stats Row */}
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span>{campaign.views}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
            <DollarSign className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span className="text-emerald-400">{campaign.revenue}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
            <MousePointerClick className="h-4 w-4" aria-hidden="true" />
            <span>{campaign.ctr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState() {
  const t = useTranslations("campaigns");

  return (
    <div className="flex flex-col items-center justify-center py-20">
      {/* Ghost Illustration */}
      <div className="relative mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800">
          <Megaphone className="h-10 w-10 text-zinc-700" aria-hidden="true" />
        </div>
        {/* Ghost rings */}
        <div className="absolute -inset-3 rounded-full border border-dashed border-zinc-800" />
        <div className="absolute -inset-6 rounded-full border border-dashed border-zinc-800/50" />
      </div>
      <h3 className="text-lg font-semibold text-white">
        {t("no_campaigns") || "No campaigns yet"}
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        {t("no_campaigns_hint") || "Create your first campaign to get started"}
      </p>
      <Button className="mt-6 bg-indigo-600 text-white hover:bg-indigo-500">
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("create_campaign") || "Create Campaign"}
      </Button>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────

function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-8 w-8 border-zinc-700"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "outline"}
          size="icon"
          onClick={() => onPageChange(page)}
          className={cn(
            "h-8 w-8 text-xs",
            page === currentPage
              ? "bg-indigo-600 text-white hover:bg-indigo-500"
              : "border-zinc-700 text-zinc-400 hover:text-white"
          )}
          aria-current={page === currentPage ? "page" : undefined}
          aria-label={`Page ${page}`}
        >
          {page}
        </Button>
      ))}

      <Button
        variant="outline"
        size="icon"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="h-8 w-8 border-zinc-700"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function CampaignManagement() {
  const t = useTranslations("campaigns");
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    channel: "all",
    dateRange: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Filtering
  const filtered = mockCampaigns.filter((c) => {
    if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status !== "all" && c.status !== filters.status) return false;
    if (filters.channel !== "all" && !c.channels.includes(filters.channel)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * CARDS_PER_PAGE,
    safePage * CARDS_PER_PAGE
  );

  const isEmpty = filtered.length === 0;

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-white">
            {t("title") || "Campaigns"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {t("subtitle") || "Manage and monitor your video campaigns"}
          </p>
        </div>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-500">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("create_campaign") || "Create Campaign"}
        </Button>
      </div>

      {/* Filter Bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Body: Cards or Empty State */}
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>

          {/* Result count + Pagination */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-zinc-400" aria-live="polite">
              {t("showing_results", {
                from: (safePage - 1) * CARDS_PER_PAGE + 1,
                to: Math.min(safePage * CARDS_PER_PAGE, filtered.length),
                total: filtered.length,
              }) || `Showing ${(safePage - 1) * CARDS_PER_PAGE + 1}-${Math.min(safePage * CARDS_PER_PAGE, filtered.length)} of ${filtered.length}`}
            </p>
            <PaginationBar
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
