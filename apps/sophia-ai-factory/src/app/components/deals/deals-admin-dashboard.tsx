'use client';

/**
 * Enterprise Deals & Autonomous Sales Agent Command Center
 *
 * Layer: forest/deals (UI presentation & orchestration)
 * Allowed imports: react, lucide-react, @/seed/*, @/tree/*, @/land/*
 *
 * @module forest/deals/deals-admin-dashboard
 */

import React, { useState, useTransition } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Flame,
  DollarSign,
  BarChart3,
  Trophy,
  RefreshCw,
  Sparkles,
  FileText,
  Cpu,
  Building2,
  User,
} from 'lucide-react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  DealStage,
  PipelineTier,
  CreateEnterpriseDealInput,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';
import {
  DealsKanbanBoard,
  DealDetailDrawer,
  MeetingPrepModal,
  ProposalGeneratorModal,
  SandboxProvisionModal,
  NewDealModal,
} from '@/forest/deals';
import {
  createEnterpriseDealAction,
  updateEnterpriseDealAction,
  enrichDealAction,
  generateMeetingPrepAction,
  generateProposalAction,
  provisionSandboxAction,
} from '@/land/admin/enterprise-deal-actions';

export interface DealsAdminDashboardProps {
  initialDeals: EnterpriseDeal[];
  initialMetrics?: {
    totalDeals: number;
    hotDeals: number;
    warmDeals: number;
    coldDeals: number;
    totalEstimatedValueCents: number;
    avgBantScore: number;
    wonDeals: number;
  };
  locale?: string;
}

export function DealsAdminDashboard({
  initialDeals,
  initialMetrics,
  locale = 'en',
}: DealsAdminDashboardProps) {
  const isVi = locale === 'vi';
  const [deals, setDeals] = useState<EnterpriseDeal[]>(initialDeals);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Modals & Drawer State
  const [selectedDeal, setSelectedDeal] = useState<EnterpriseDeal | null>(null);
  const [selectedEnrichment, setSelectedEnrichment] = useState<EnterpriseLeadEnrichment | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isPrepOpen, setIsPrepOpen] = useState(false);
  const [prepDossier, setPrepDossier] = useState<MeetingPrepDossier | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [proposalResult, setProposalResult] = useState<EnterpriseProposalResult | null>(null);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxProvisionResult | null>(null);

  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Filter deals
  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      !search ||
      deal.companyName.toLowerCase().includes(search.toLowerCase()) ||
      deal.companyDomain.toLowerCase().includes(search.toLowerCase()) ||
      deal.leadName.toLowerCase().includes(search.toLowerCase()) ||
      deal.leadEmail.toLowerCase().includes(search.toLowerCase());

    const matchesStage = stageFilter === 'all' || deal.dealStage === stageFilter;
    const matchesTier = tierFilter === 'all' || deal.pipelineTier === tierFilter;

    return matchesSearch && matchesStage && matchesTier;
  });

  // Open Drawer
  const handleSelectDeal = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setIsDrawerOpen(true);
  };

  // Open Prep Modal
  const handleOpenMeetingPrep = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setPrepDossier(
      deal.meetingPrepBrief
        ? {
            dealId: deal.id,
            companyOverview: `${deal.companyName} (${deal.companyDomain})`,
            keyStakeholders: deal.leadName,
            painPointAnalysis: deal.notes || 'APAC multi-language video automation',
            proposedSolutionBlueprint: 'Sophia AI Factory 5-Language Video Dubbing & GPU Mesh',
            commercialRecommendation: 'Enterprise Growth Tier (100K MCU/mo)',
            battlecards: [],
            fullBriefMarkdown: deal.meetingPrepBrief,
            generatedAt: deal.updatedAt,
          }
        : null
    );
    setIsPrepOpen(true);
  };

  // Open Proposal Modal
  const handleOpenProposal = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setProposalResult(
      deal.proposalContent
        ? {
            proposalId: deal.proposalId || `prop_${deal.id.slice(0, 8)}`,
            dealId: deal.id,
            language: deal.proposalLanguage,
            title: `Enterprise Proposal — ${deal.companyName}`,
            sections: [],
            fullMarkdown: deal.proposalContent,
            wordCount: deal.proposalContent.split(/\s+/).length,
            qualityPassed: true,
            generatedAt: deal.updatedAt,
          }
        : null
    );
    setIsProposalOpen(true);
  };

  // Open Sandbox Modal
  const handleOpenSandbox = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setSandboxResult(
      deal.sandboxSubaccountId
        ? {
            dealId: deal.id,
            subaccountId: deal.sandboxSubaccountId,
            subaccountName: `${deal.companyName} Sandbox Demo`,
            slug: `demo-${deal.companyDomain.split('.')[0]}`,
            allocatedMcu: 1000,
            expiresAt: deal.sandboxExpiresAt || Date.now() + 14 * 86400000,
            sandboxToken: deal.sandboxToken || '',
            demoMagicUrl: `https://sophia.agencyos.network/sandbox/${deal.sandboxToken || ''}`,
            watermarkEnabled: true,
          }
        : null
    );
    setIsSandboxOpen(true);
  };

  // Create Deal Action
  const handleCreateDeal = async (input: CreateEnterpriseDealInput) => {
    setLoadingAction('create');
    try {
      const res = await createEnterpriseDealAction(input);
      if (res.success && res.data) {
        setDeals((prev) => [res.data!, ...prev]);
        setIsNewDealOpen(false);
      } else {
        alert(res.error || 'Failed to create deal');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // Stage change action
  const handleStageChange = async (newStage: DealStage) => {
    if (!selectedDeal) return;
    const res = await updateEnterpriseDealAction(selectedDeal.id, { dealStage: newStage });
    if (res.success && res.data) {
      setDeals((prev) => prev.map((d) => (d.id === res.data!.id ? res.data! : d)));
      setSelectedDeal(res.data);
    }
  };

  // Enrich action
  const handleEnrich = async () => {
    if (!selectedDeal) return;
    setLoadingAction('enrich');
    try {
      const res = await enrichDealAction(selectedDeal.id, { forceRefresh: true });
      if (res.success && res.data) {
        setSelectedEnrichment(res.data.enrichment);
        setSelectedDeal(res.data.deal);
        setDeals((prev) => prev.map((d) => (d.id === res.data!.deal.id ? res.data!.deal : d)));
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // Generate meeting prep action
  const handleGeneratePrep = async () => {
    if (!selectedDeal) return;
    setLoadingAction('prep');
    try {
      const res = await generateMeetingPrepAction(selectedDeal.id);
      if (res.success && res.data) {
        setPrepDossier(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id
              ? { ...d, meetingPrepBrief: res.data!.fullBriefMarkdown, dealStage: 'demo_prepared' }
              : d
          )
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // Generate proposal action
  const handleGenerateProposal = async (lang: ProposalLanguage) => {
    if (!selectedDeal) return;
    setLoadingAction('proposal');
    try {
      const res = await generateProposalAction(selectedDeal.id, lang);
      if (res.success && res.data) {
        setProposalResult(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id
              ? {
                  ...d,
                  proposalId: res.data!.proposalId,
                  proposalLanguage: lang,
                  proposalContent: res.data!.fullMarkdown,
                  dealStage: 'proposal_sent',
                }
              : d
          )
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // Provision sandbox action
  const handleProvisionSandbox = async () => {
    if (!selectedDeal) return;
    setLoadingAction('sandbox');
    try {
      const res = await provisionSandboxAction(selectedDeal.id);
      if (res.success && res.data) {
        setSandboxResult(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id
              ? {
                  ...d,
                  sandboxSubaccountId: res.data!.subaccountId,
                  sandboxStatus: 'active',
                  sandboxToken: res.data!.sandboxToken,
                  sandboxExpiresAt: res.data!.expiresAt,
                  dealStage: 'demo_active',
                }
              : d
          )
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const totalValue = deals.reduce((sum, d) => sum + (d.dealValueEstimateCents || 0), 0);
  const hotCount = deals.filter((d) => d.pipelineTier === 'hot').length;
  const wonCount = deals.filter((d) => d.dealStage === 'closed_won').length;
  const avgBant = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.bantScore, 0) / deals.length) : 0;

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Top Banner & Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isVi ? 'Quản Trị Cơ Hội Bán Hàng B2B & Làm Giàu Dữ Liệu AI' : 'Autonomous Enterprise Sales & B2B AI Fleet'}
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {isVi
              ? 'Cỗ máy thu nạp khách hàng doanh nghiệp, chấm điểm BANT 4 yếu tố, tạo đề xuất song ngữ và kích hoạt workspace demo 1-chạm.'
              : 'Enterprise lead ingestion, deterministic BANT scoring, bilingual proposal generation, and 1-click sandboxed demo provisioning.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewDealOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            {isVi ? 'Thêm Deal Mới' : 'Ingest New Deal'}
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{isVi ? 'Tổng Giá Trị Phễu' : 'Pipeline Value'}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white">${(totalValue / 100).toLocaleString()}</div>
          <div className="text-[11px] text-zinc-500">{deals.length} active enterprise deals</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{isVi ? 'Deal Nóng (BANT ≥75)' : 'Hot Deals'}</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400">{hotCount}</div>
          <div className="text-[11px] text-zinc-500">Auto-assigned AI executive</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{isVi ? 'Điểm BANT Trung Bình' : 'Avg BANT Score'}</span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400">{avgBant} / 100</div>
          <div className="text-[11px] text-zinc-500">Deterministic 4-factor</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{isVi ? 'Đã Chốt (Closed Won)' : 'Closed Won'}</span>
            <Trophy className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-400">{wonCount}</div>
          <div className="text-[11px] text-zinc-500">SLA contract active</div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{isVi ? 'Dung Lượng Đề Xuất' : 'MCU Capacity'}</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-400">
            {deals.reduce((sum, d) => sum + (d.requestedMcuMonthly || 0), 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-500">Requested MCU/month</div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder={isVi ? 'Tìm kiếm theo tên công ty, domain, liên hệ...' : 'Search company, domain, contact...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-emerald-500 capitalize"
            >
              <option value="all">{isVi ? 'Tất cả giai đoạn' : 'All Stages'}</option>
              <option value="new_lead">New Lead</option>
              <option value="qualified">Qualified</option>
              <option value="demo_prepared">Demo Prepared</option>
              <option value="demo_active">Demo Active</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="negotiating">Negotiating</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-emerald-500 capitalize"
            >
              <option value="all">{isVi ? 'Tất cả mức BANT' : 'All BANT Tiers'}</option>
              <option value="hot">🔥 Hot Deals (≥75)</option>
              <option value="warm">⚡ Warm Deals (50–74)</option>
              <option value="cold">❄️ Cold Deals (&lt;50)</option>
            </select>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'kanban'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'table'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'kanban' ? (
        <DealsKanbanBoard
          deals={filteredDeals}
          onSelectDeal={handleSelectDeal}
          onOpenMeetingPrep={handleOpenMeetingPrep}
          onOpenProposal={handleOpenProposal}
          onOpenSandbox={handleOpenSandbox}
        />
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Company &amp; Domain</th>
                  <th className="px-4 py-3">Lead Contact</th>
                  <th className="px-4 py-3">BANT Score</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Est. Value</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                      No matching enterprise deals found.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      onClick={() => handleSelectDeal(deal)}
                      className="hover:bg-zinc-900/60 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                          {deal.companyName}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">{deal.companyDomain}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-200">{deal.leadName}</div>
                        <div className="text-[11px] text-zinc-400">{deal.leadEmail}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-200">
                        {deal.bantScore}/100
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            deal.pipelineTier === 'hot'
                              ? 'bg-rose-500/10 text-rose-400'
                              : deal.pipelineTier === 'warm'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {deal.pipelineTier}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-zinc-300">
                        {deal.dealStage.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        ${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="AI Dossier"
                            onClick={() => handleOpenMeetingPrep(deal)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-purple-400"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Generate Proposal"
                            onClick={() => handleOpenProposal(deal)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Demo Sandbox"
                            onClick={() => handleOpenSandbox(deal)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals & Drawer */}
      <DealDetailDrawer
        deal={selectedDeal}
        enrichment={selectedEnrichment}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onStageChange={handleStageChange}
        onEnrich={handleEnrich}
        onOpenMeetingPrep={() => selectedDeal && handleOpenMeetingPrep(selectedDeal)}
        onOpenProposal={() => selectedDeal && handleOpenProposal(selectedDeal)}
        onOpenSandbox={() => selectedDeal && handleOpenSandbox(selectedDeal)}
        isEnriching={loadingAction === 'enrich'}
      />

      {selectedDeal && (
        <>
          <MeetingPrepModal
            deal={selectedDeal}
            dossier={prepDossier}
            isOpen={isPrepOpen}
            onClose={() => setIsPrepOpen(false)}
            onGenerate={handleGeneratePrep}
            isLoading={loadingAction === 'prep'}
          />

          <ProposalGeneratorModal
            deal={selectedDeal}
            proposal={proposalResult}
            isOpen={isProposalOpen}
            onClose={() => setIsProposalOpen(false)}
            onGenerate={handleGenerateProposal}
            isLoading={loadingAction === 'proposal'}
          />

          <SandboxProvisionModal
            deal={selectedDeal}
            sandbox={sandboxResult}
            isOpen={isSandboxOpen}
            onClose={() => setIsSandboxOpen(false)}
            onProvision={handleProvisionSandbox}
            isLoading={loadingAction === 'sandbox'}
          />
        </>
      )}

      <NewDealModal
        isOpen={isNewDealOpen}
        onClose={() => setIsNewDealOpen(false)}
        onSubmit={handleCreateDeal}
        isLoading={loadingAction === 'create'}
      />
    </div>
  );
}
