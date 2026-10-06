'use client';

/**
 * High-Performance Agency Admin Portal
 *
 * Provides agency owners and managers with a unified cockpit:
 * - Real-time KPI metric overview (Clients, MCU Quota, Campaigns, MRR, Growth)
 * - Tenant-isolated client subaccounts table with search, status toggles, and MCU reallocation
 * - Active video deliverable campaigns tracker with review status badges
 * - Client revenue attribution & margin breakdown with quota burn velocity alerts
 *
 * Layer: forest/agency (UI components & presentation)
 * Allowed imports: react, lucide-react, @/seed/*, @/tree/*, @/land/agency/*
 *
 * @module forest/agency/agency-admin-portal
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Video,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  Sliders,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type {
  AgencyAdminDashboardData,
  AgencyClientSummary,
  AgencyCampaignSummary,
  AgencyRevenueAttribution,
  VelocityAlertStatus,
} from '@/seed/types';

export interface AgencyAdminPortalActions {
  updateClientStatus?: (
    subaccountId: string,
    agencyOrgId: string,
    status: 'active' | 'suspended'
  ) => Promise<{ success: boolean; error?: string }>;
  reallocateQuota?: (
    subaccountId: string,
    agencyOrgId: string,
    allocatedMcu: number
  ) => Promise<{ success: boolean; remainingMcu?: number; error?: string }>;
}

export interface AgencyAdminPortalProps {
  initialData: AgencyAdminDashboardData;
  locale?: 'en' | 'vi';
  actions?: AgencyAdminPortalActions;
}

export function AgencyAdminPortal({
  initialData,
  locale = 'vi',
  actions,
}: AgencyAdminPortalProps) {
  const isVi = locale === 'vi';

  // Dashboard state
  const [data, setData] = useState<AgencyAdminDashboardData>(initialData);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [editingQuotaClient, setEditingQuotaClient] = useState<AgencyClientSummary | null>(null);
  const [newQuotaValue, setNewQuotaValue] = useState<number>(0);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter clients
  const filteredClients = data.clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Client status toggle
  const handleToggleStatus = async (client: AgencyClientSummary) => {
    const nextStatus = client.status === 'active' ? 'suspended' : 'active';
    setIsUpdating(client.id);
    setActionError(null);

    if (!actions?.updateClientStatus) {
      setActionError(
        isVi
          ? 'Hành động cập nhật trạng thái chưa được cung cấp'
          : 'Status update action not provided'
      );
      setIsUpdating(null);
      return;
    }

    try {
      const res = await actions.updateClientStatus(
        client.id,
        data.agencyContext.agencyId,
        nextStatus
      );

      if (res.success) {
        setData((prev) => ({
          ...prev,
          clients: prev.clients.map((c) =>
            c.id === client.id ? { ...c, status: nextStatus } : c
          ),
        }));
      } else {
        setActionError(res.error || (isVi ? 'Không thể cập nhật trạng thái' : 'Failed to update status'));
      }
    } catch {
      setActionError(isVi ? 'Lỗi kết nối máy chủ' : 'Network error');
    } finally {
      setIsUpdating(null);
    }
  };

  // Quota reallocation
  const handleSaveQuota = async () => {
    if (!editingQuotaClient) return;
    setIsUpdating(editingQuotaClient.id);
    setActionError(null);

    if (!actions?.reallocateQuota) {
      setActionError(
        isVi
          ? 'Hành động phân bổ hạn mức chưa được cung cấp'
          : 'Quota reallocation action not provided'
      );
      setIsUpdating(null);
      return;
    }

    try {
      const res = await actions.reallocateQuota(
        editingQuotaClient.id,
        data.agencyContext.agencyId,
        newQuotaValue
      );

      if (res.success) {
        setData((prev) => ({
          ...prev,
          clients: prev.clients.map((c) =>
            c.id === editingQuotaClient.id
              ? {
                  ...c,
                  allocatedMcu: newQuotaValue,
                  mcuUtilizationRate:
                    newQuotaValue > 0
                      ? Math.min(100, Math.round((c.usedMcu / newQuotaValue) * 100))
                      : 0,
                }
              : c
          ),
          kpi: {
            ...prev.kpi,
            totalAllocatedMcu:
              prev.kpi.totalAllocatedMcu - editingQuotaClient.allocatedMcu + newQuotaValue,
          },
        }));
        setEditingQuotaClient(null);
      } else {
        setActionError(res.error || (isVi ? 'Không thể phân bổ điểm MCU' : 'Failed to reallocate MCU'));
      }
    } catch {
      setActionError(isVi ? 'Lỗi kết nối máy chủ' : 'Network error');
    } finally {
      setIsUpdating(null);
    }
  };

  const renderVelocityBadge = (status: VelocityAlertStatus) => {
    if (status === 'exceeded') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500">
          <ShieldAlert className="w-3 h-3" />
          {isVi ? 'Đã Vượt Hạn Mức' : 'Exceeded'}
        </span>
      );
    }
    if (status === 'near_limit') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500">
          <AlertTriangle className="w-3 h-3" />
          {isVi ? 'Sắp Hết (>80%)' : 'Near Limit'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500">
        <ShieldCheck className="w-3 h-3" />
        {isVi ? 'Bình Thường' : 'Normal'}
      </span>
    );
  };

  const renderCampaignBadge = (status: AgencyCampaignSummary['status']) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
          <CheckCircle className="w-3 h-3" />
          {isVi ? 'Đã Phê Duyệt' : 'Approved'}
        </span>
      );
    }
    if (status === 'in_review') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-500">
          <Clock className="w-3 h-3" />
          {isVi ? 'Đang Chờ Khách Duyệt' : 'In Client Review'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">
        {isVi ? 'Bản Thảo' : 'Draft'}
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary uppercase tracking-wide">
              {data.agencyContext.agencyName}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              @{data.agencyContext.agencySlug}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            {isVi ? 'Bảng Điều Khiển Quản Trị Doanh Nghiệp' : 'Agency Operations Cockpit'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isVi
              ? 'Quản lý khách hàng, chiến dịch sản xuất video, hạn mức điểm và doanh thu định kỳ.'
              : 'Manage your clients, video campaigns, credit quotas, and revenue attribution.'}
          </p>
        </div>

        <div>
          <Link
            href={`/${locale}/agency/onboarding`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isVi ? 'Khởi Tạo Khách Hàng Mới' : 'Onboard New Client'}
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
          {actionError}
        </div>
      )}

      {/* KPI Overviews Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Clients */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {isVi ? 'Khách Hàng Đang Hoạt Động' : 'Active Client Workspaces'}
            </p>
            <h3 className="text-2xl font-bold text-foreground mt-1">
              {data.kpi.totalActiveClients}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isVi ? 'Không gian làm việc riêng biệt' : 'Isolated client spaces'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: MCU Quota Utilization */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div className="flex-1 mr-3">
            <p className="text-xs font-medium text-muted-foreground">
              {isVi ? 'Tỷ Lệ Tiêu Hao Điểm' : 'Credit Quota Utilization'}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-foreground">
                {data.kpi.mcuUtilizationRate}%
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {data.kpi.totalUsedMcu}/{data.kpi.totalAllocatedMcu} MCU
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  data.kpi.mcuUtilizationRate > 80
                    ? 'bg-rose-500'
                    : data.kpi.mcuUtilizationRate > 60
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, data.kpi.mcuUtilizationRate)}%` }}
              />
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Active Campaigns */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {isVi ? 'Chiến Dịch Đang Thực Hiện' : 'Active Video Deliverables'}
            </p>
            <h3 className="text-2xl font-bold text-foreground mt-1">
              {data.kpi.activeCampaigns}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isVi ? 'Bản thảo video đang duyệt' : 'Review links in flight'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Video className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Attributed MRR */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {isVi ? 'Doanh Thu Định Kỳ Ước Tính' : 'Attributed Monthly Value'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-2xl font-bold text-foreground">
                ${data.kpi.attributedMrrUsd.toLocaleString()}
              </h3>
              <span className="inline-flex items-center text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3 mr-0.5" />+{data.kpi.growthRatePercent}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isVi ? 'Doanh thu danh mục quản lý' : 'Portfolio attributed MRR'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Section: Clients Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isVi ? 'Danh Sách Khách Hàng' : 'Client Subaccounts'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isVi
                ? 'Theo dõi hạn mức điểm và cổng thông tin thương hiệu riêng của từng khách hàng.'
                : 'Monitor credit limits and sovereign portals for each client subaccount.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isVi ? 'Tìm theo tên hoặc đường dẫn...' : 'Search by name or slug...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isVi ? 'Tất cả' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isVi ? 'Hoạt động' : 'Active'}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('suspended')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'suspended'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isVi ? 'Tạm dừng' : 'Suspended'}
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground border-b border-border uppercase font-medium">
              <tr>
                <th className="px-6 py-3">{isVi ? 'Tên Khách Hàng' : 'Client Name'}</th>
                <th className="px-6 py-3">{isVi ? 'Trạng Thái' : 'Status'}</th>
                <th className="px-6 py-3">{isVi ? 'Hạn Mức Điểm (MCU)' : 'Credit Quota'}</th>
                <th className="px-6 py-3">{isVi ? 'Cổng Thông Tin' : 'Client Portal'}</th>
                <th className="px-6 py-3 text-right">{isVi ? 'Thao Tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    {isVi
                      ? 'Chưa có khách hàng nào phù hợp. Hãy khởi tạo khách hàng mới để bắt đầu.'
                      : 'No client subaccounts found. Onboard your first client to get started.'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isUpdatingThis = isUpdating === client.id;
                  return (
                    <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground text-sm">{client.name}</div>
                        <div className="text-muted-foreground font-mono text-[11px]">
                          /{client.slug}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {client.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {isVi ? 'Hoạt Động' : 'Active'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {isVi ? 'Tạm Dừng' : 'Suspended'}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground">
                            {client.usedMcu} / {client.allocatedMcu}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({client.mcuUtilizationRate}%)
                          </span>
                        </div>
                        <div className="w-32 bg-muted rounded-full h-1 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              client.mcuUtilizationRate > 80
                                ? 'bg-rose-500'
                                : client.mcuUtilizationRate > 60
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, client.mcuUtilizationRate)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <Link
                          href={client.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                        >
                          <span>{client.customDomain || client.portalUrl}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>

                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuotaClient(client);
                            setNewQuotaValue(client.allocatedMcu);
                          }}
                          className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors"
                        >
                          <Sliders className="w-3 h-3 inline mr-1" />
                          {isVi ? 'Đổi Hạn Mức' : 'Edit Quota'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(client)}
                          disabled={isUpdatingThis}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            client.status === 'active'
                              ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                          }`}
                        >
                          {isUpdatingThis ? (
                            <RefreshCw className="w-3 h-3 animate-spin inline" />
                          ) : client.status === 'active' ? (
                            isVi ? 'Tạm Dừng' : 'Suspend'
                          ) : (
                            isVi ? 'Kích Hoạt' : 'Activate'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid of Two Cards: Active Campaigns & Revenue Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Active Video Deliverables */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {isVi ? 'Sản Phẩm Video Gần Đây' : 'Recent Video Deliverables'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isVi
                  ? 'Trạng thái bản thảo video đang được gửi tới khách hàng.'
                  : 'Latest drafts and approval states dispatched to clients.'}
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {data.campaigns.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {data.campaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                {isVi
                  ? 'Chưa có bản thảo video nào đang chờ duyệt.'
                  : 'No active video review links or drafts found.'}
              </p>
            ) : (
              data.campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground">{campaign.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {campaign.clientName} • {campaign.mcuConsumed} MCU
                    </div>
                  </div>
                  <div>{renderCampaignBadge(campaign.status)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 2: Revenue & Margin Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {isVi ? 'Phân Bổ Doanh Thu & Hiệu Quả' : 'Revenue & Margin Breakdown'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isVi
                  ? 'Ước tính giá trị định kỳ, tỷ suất lợi nhuận và tốc độ dùng hạn mức.'
                  : 'Estimated monthly value, gross margin, and quota burn velocity.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border font-medium">
                <tr>
                  <th className="px-3 py-2">{isVi ? 'Khách Hàng' : 'Client'}</th>
                  <th className="px-3 py-2">{isVi ? 'Giá Trị' : 'MRR'}</th>
                  <th className="px-3 py-2">{isVi ? 'Lợi Nhuận' : 'Margin'}</th>
                  <th className="px-3 py-2">{isVi ? 'Tốc Độ Dùng' : 'Velocity'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.attribution.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      {isVi ? 'Chưa có dữ liệu phân bổ.' : 'No attribution data.'}
                    </td>
                  </tr>
                ) : (
                  data.attribution.slice(0, 5).map((att) => (
                    <tr key={att.subaccountId}>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {att.clientName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-foreground font-semibold">
                        ${att.mrrUsd}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-emerald-500 font-semibold">
                        {att.marginPercent}%
                      </td>
                      <td className="px-3 py-2.5">{renderVelocityBadge(att.velocityStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quota Reallocation Modal */}
      {editingQuotaClient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                {isVi ? 'Điều Chỉnh Hạn Mức MCU' : 'Reallocate Credit Quota'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingQuotaClient(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {isVi
                ? `Cập nhật hạn mức điểm sản xuất cho khách hàng ${editingQuotaClient.name}.`
                : `Update allocated video production compute points for ${editingQuotaClient.name}.`}
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                {isVi ? 'Hạn Mức MCU Mới' : 'New Allocated MCU'}
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={newQuotaValue}
                onChange={(e) => setNewQuotaValue(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingQuotaClient(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isVi ? 'Hủy Bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveQuota}
                disabled={isUpdating === editingQuotaClient.id}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUpdating === editingQuotaClient.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isVi ? (
                  'Lưu Hạn Mức'
                ) : (
                  'Save Quota'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
