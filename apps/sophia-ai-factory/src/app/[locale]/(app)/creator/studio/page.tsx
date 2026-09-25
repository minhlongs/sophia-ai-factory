'use client';

/**
 * Bilingual Creator Studio Portal
 *
 * Route: /[locale]/(app)/creator/studio
 * Accessible at: /creator/studio, /vi/creator/studio, /en/creator/studio
 *
 * Implements Milestone 2 (R2):
 * - Autonomous Creator Marketplace & 70/30 Royalty Protocol
 * - Template Registry, Review Statuses & Quality Ratings
 * - OCC CAS Ledger Earnings & Balances
 * - Dual-Rail Withdrawals: Web3 USDT (TRC-20) & Vietnam Domestic VietQR (NAPAS 247)
 *
 * @module app/[locale]/(app)/creator/studio/page
 */

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Layers,
  DollarSign,
  TrendingUp,
  Wallet,
  Plus,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  Building2,
  Coins,
  RefreshCw,
  Eye,
  Sparkles,
} from 'lucide-react';
import type {
  CreatorTemplate,
  CreatorStudioStats,
  WithdrawalRequest,
  PayoutRail,
  TemplateStatus,
  CreatorTemplatePlatform,
} from '@/seed/types/creator-marketplace';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

const NAPAS_BANKS = [
  { bin: '970422', name: 'MBBank (NHTM CP Quân Đội)', short: 'MB' },
  { bin: '970436', name: 'Vietcombank (Ngoại Thương Việt Nam)', short: 'VCB' },
  { bin: '970407', name: 'Techcombank (Kỹ Thương Việt Nam)', short: 'TCB' },
  { bin: '970416', name: 'ACB (Á Châu)', short: 'ACB' },
  { bin: '970415', name: 'VietinBank (Công Thương Việt Nam)', short: 'CTG' },
  { bin: '970432', name: 'VPBank (Việt Nam Thịnh Vượng)', short: 'VPB' },
  { bin: '970423', name: 'TPBank (Tiên Phong)', short: 'TPB' },
];

export default function CreatorStudioPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';

  // Tabs: 'templates' | 'withdrawals' | 'settings'
  const [activeTab, setActiveTab] = useState<'templates' | 'withdrawals'>('templates');

  // Data states
  const [stats, setStats] = useState<CreatorStudioStats>({
    totalTemplates: 0,
    totalUses: 0,
    grossEarningsCents: 0,
    creatorRoyaltyCents: 0,
    platformFeesCents: 0,
    availableBalanceCents: 0,
    pendingBalanceCents: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [templates, setTemplates] = useState<CreatorTemplate[]>([]);
  const [withdrawals, setWithdrawals] = useState<
    Array<WithdrawalRequest & { vietQr?: { qrUrl: string; amountVnd: number; amountUsd: number } | null }>
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [submittingTemplate, setSubmittingTemplate] = useState<boolean>(false);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    niche: 'general',
    targetPlatform: 'tiktok' as CreatorTemplatePlatform,
    aspectRatio: '9:16' as '9:16' | '16:9' | '1:1',
    hookStyle: 'curiosity_gap',
    scriptTemplate: '',
    visualStylePrompt: '',
    musicPrompt: '',
    priceDollars: '20',
  });

  // Withdrawal Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amountDollars: '50',
    rail: 'USDT' as PayoutRail,
    destinationAddress: '',
    bankBin: '970422',
    bankAccountNumber: '',
    bankAccountName: '',
  });

  // Active VietQR Preview Modal
  const [activeQrModal, setActiveQrModal] = useState<{
    qrUrl: string;
    amountVnd: number;
    amountUsd: number;
    bankName: string;
    accountNumber: string;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [tmplRes, withRes] = await Promise.all([
        fetch('/api/creator/templates'),
        fetch('/api/creator/withdrawals'),
      ]);

      if (tmplRes.ok) {
        const tmplData = (await tmplRes.json()) as { templates: CreatorTemplate[]; total: number };
        setTemplates(tmplData.templates || []);
      }

      if (withRes.ok) {
        const withData = (await withRes.json()) as {
          withdrawals: Array<WithdrawalRequest & { vietQr?: { qrUrl: string; amountVnd: number; amountUsd: number } | null }>;
          balances?: { availableCents: number; unencumberedCents: number };
        };
        setWithdrawals(withData.withdrawals || []);
        if (withData.balances) {
          setStats((prev) => ({
            ...prev,
            availableBalanceCents: withData.balances?.unencumberedCents ?? prev.availableBalanceCents,
          }));
        }
      }
    } catch (err) {
      setErrorMsg(isVi ? 'Không thể tải dữ liệu phòng sáng tạo.' : 'Failed to load studio data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTemplate(true);
    setErrorMsg(null);

    const priceCents = Math.round(parseFloat(templateForm.priceDollars || '0') * 100);

    try {
      const res = await fetch('/api/creator/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: templateForm.title,
          description: templateForm.description || undefined,
          niche: templateForm.niche,
          targetPlatform: templateForm.targetPlatform,
          aspectRatio: templateForm.aspectRatio,
          hookStyle: templateForm.hookStyle,
          scriptTemplate: templateForm.scriptTemplate,
          visualStylePrompt: templateForm.visualStylePrompt,
          musicPrompt: templateForm.musicPrompt || undefined,
          priceCents,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to submit template');
      }

      setIsTemplateModalOpen(false);
      setTemplateForm({
        title: '',
        description: '',
        niche: 'general',
        targetPlatform: 'tiktok',
        aspectRatio: '9:16',
        hookStyle: 'curiosity_gap',
        scriptTemplate: '',
        visualStylePrompt: '',
        musicPrompt: '',
        priceDollars: '20',
      });
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWithdraw(true);
    setErrorMsg(null);

    const amountCents = Math.round(parseFloat(withdrawForm.amountDollars || '0') * 100);

    try {
      const res = await fetch('/api/creator/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          rail: withdrawForm.rail,
          destinationAddress: withdrawForm.rail === 'USDT' ? withdrawForm.destinationAddress : undefined,
          bankBin: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankBin : undefined,
          bankAccountNumber: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankAccountNumber : undefined,
          bankAccountName: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankAccountName : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Withdrawal failed');
      }

      const result = (await res.json()) as {
        withdrawal: WithdrawalRequest;
        vietQr?: { qrUrl: string; amountVnd: number; amountUsd: number } | null;
      };

      setIsWithdrawModalOpen(false);
      await fetchData();

      if (result.vietQr) {
        setActiveQrModal({
          qrUrl: result.vietQr.qrUrl,
          amountVnd: result.vietQr.amountVnd,
          amountUsd: result.vietQr.amountUsd,
          bankName: NAPAS_BANKS.find((b) => b.bin === withdrawForm.bankBin)?.short || 'NAPAS',
          accountNumber: withdrawForm.bankAccountNumber,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Withdrawal submission failed');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const formatUsd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const renderStatusBadge = (status: TemplateStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            {isVi ? 'Đã duyệt' : 'Approved'}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            {isVi ? 'Đang xét duyệt' : 'Pending Review'}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            {isVi ? 'Từ chối' : 'Rejected'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400 border border-zinc-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {isVi ? 'Phòng Sáng Tạo & Giao Thức 70/30' : 'Creator Studio & 70/30 Protocol'}
            </h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {isVi
              ? 'Đóng gói mẫu video viral, chia sẻ doanh thu 70% tự động & rút tiền qua USDT / VietQR.'
              : 'Package viral video recipes, earn 70% automatic royalties & withdraw via USDT or VietQR.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            {isVi ? 'Đăng Mẫu Mới' : 'New Template'}
          </button>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-sm transition-all border border-zinc-700"
          >
            <Wallet className="h-4 w-4" />
            {isVi ? 'Rút Tiền Hoa Hồng' : 'Withdraw Earnings'}
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Earnings */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Doanh Thu Gộp' : 'Gross Volume'}</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-100">
            {formatUsd(stats.grossEarningsCents)}
          </div>
          <p className="text-xs text-zinc-500">
            {isVi ? '100% doanh thu kích hoạt mẫu' : '100% template activation fees'}
          </p>
        </div>

        {/* Creator Royalty 70% */}
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-indigo-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Hoa Hồng Tác Giả (70%)' : 'Creator Royalties (70%)'}</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-indigo-300">
            {formatUsd(stats.creatorRoyaltyCents)}
          </div>
          <p className="text-xs text-indigo-400/80">
            {isVi ? 'Trích 70% không hao hụt cent' : 'Pure integer 70% allocation'}
          </p>
        </div>

        {/* Available Balance */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Số Dư Khả Dụng' : 'Available Balance'}</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-300">
            {formatUsd(stats.availableBalanceCents)}
          </div>
          <p className="text-xs text-zinc-500">
            {isVi ? 'Sẵn sàng rút về USDT / VietQR' : 'Ready for dual-rail withdrawal'}
          </p>
        </div>

        {/* Templates & Rating */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-2 backdrop-blur">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>{isVi ? 'Mẫu & Đánh Giá' : 'Templates & Score'}</span>
            <Star className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span>{templates.length}</span>
            <span className="text-sm font-normal text-zinc-400">
              ({templates.reduce((acc, t) => acc + t.useCount, 0)} {isVi ? 'lượt dùng' : 'uses'})
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            ⭐ {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '5.0'} / 5.0 (
            {stats.totalReviews} {isVi ? 'đánh giá' : 'reviews'})
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 font-medium text-sm transition-all border-b-2 ${
            activeTab === 'templates'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Mẫu Video Của Bạn' : 'My Video Templates'} ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-3 font-medium text-sm transition-all border-b-2 ${
            activeTab === 'withdrawals'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Lịch Sử Rút Tiền' : 'Withdrawal History'} ({withdrawals.length})
        </button>
      </div>

      {/* Tab: Templates List */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-zinc-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              {isVi ? 'Đang tải danh sách mẫu...' : 'Loading templates...'}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl space-y-3">
              <Layers className="h-10 w-10 text-zinc-600 mx-auto" />
              <h3 className="text-base font-semibold text-zinc-300">
                {isVi ? 'Chưa có mẫu video nào' : 'No video templates created yet'}
              </h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                {isVi
                  ? 'Bắt đầu đóng gói công thức kịch bản và phong cách viral của bạn để nhận 70% hoa hồng trên mỗi lượt tạo video.'
                  : 'Start publishing your viral video recipes and prompts to earn 70% royalties whenever users generate videos.'}
              </p>
              <button
                onClick={() => setIsTemplateModalOpen(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                {isVi ? 'Tạo Mẫu Đầu Tiên' : 'Create First Template'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-4 flex flex-col justify-between hover:border-zinc-700 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase font-semibold text-indigo-400 tracking-wider">
                        {tmpl.niche} • {tmpl.targetPlatform}
                      </span>
                      {renderStatusBadge(tmpl.status)}
                    </div>
                    <h3 className="text-lg font-bold text-zinc-100 line-clamp-1">{tmpl.title}</h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">{tmpl.scriptTemplate}</p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <div>
                      <span className="text-zinc-500">{isVi ? 'Giá:' : 'Price:'} </span>
                      <span className="text-zinc-200 font-semibold">{formatUsd(tmpl.priceCents)}</span>
                      <span className="text-indigo-400 ml-1">(70% = {formatUsd(Math.floor(tmpl.priceCents * 0.7))})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{tmpl.useCount} {isVi ? 'dùng' : 'uses'}</span>
                      {tmpl.rating > 0 && <span>⭐ {tmpl.rating.toFixed(1)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Withdrawals History */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-zinc-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              {isVi ? 'Đang tải lịch sử rút tiền...' : 'Loading withdrawals...'}
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl space-y-3">
              <Wallet className="h-10 w-10 text-zinc-600 mx-auto" />
              <h3 className="text-base font-semibold text-zinc-300">
                {isVi ? 'Chưa có yêu cầu rút tiền nào' : 'No withdrawal requests yet'}
              </h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                {isVi
                  ? 'Khi số dư hoa hồng đạt tối thiểu $50.00, bạn có thể gửi yêu cầu rút về ví USDT hoặc tài khoản ngân hàng VietQR.'
                  : 'Once your royalty balance reaches $50.00, you can request a disbursement via USDT or VietQR.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="p-4">{isVi ? 'Mã Yêu Cầu' : 'Request ID'}</th>
                    <th className="p-4">{isVi ? 'Cổng Rút' : 'Rail'}</th>
                    <th className="p-4">{isVi ? 'Số Tiền (USD)' : 'Amount (USD)'}</th>
                    <th className="p-4">{isVi ? 'Người Nhận / Tài Khoản' : 'Recipient Info'}</th>
                    <th className="p-4">{isVi ? 'Trạng Thái' : 'Status'}</th>
                    <th className="p-4">{isVi ? 'Hành Động' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-900/40">
                      <td className="p-4 font-mono text-xs text-zinc-400">{w.id.slice(0, 16)}...</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded ${
                          w.rail === 'USDT' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {w.rail === 'USDT' ? <Coins className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {w.rail}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-zinc-100">{formatUsd(w.amountCents)}</td>
                      <td className="p-4 text-xs font-mono">
                        {w.rail === 'USDT'
                          ? w.destinationAddress || 'N/A'
                          : `${w.bankBin} • ${w.bankAccountNumber} • ${w.bankAccountName || ''}`}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                          w.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : w.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-zinc-500/10 text-zinc-400'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {w.vietQr && (
                          <button
                            onClick={() =>
                              setActiveQrModal({
                                qrUrl: w.vietQr!.qrUrl,
                                amountVnd: w.vietQr!.amountVnd,
                                amountUsd: w.vietQr!.amountUsd,
                                bankName: NAPAS_BANKS.find((b) => b.bin === w.bankBin)?.short || 'NAPAS',
                                accountNumber: w.bankAccountNumber || '',
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            <QrCode className="h-3 w-3" />
                            {isVi ? 'Xem VietQR' : 'View QR'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: New Template */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-xl space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-100">
                {isVi ? 'Đóng Gói Mẫu Video Nhà Sáng Tạo' : 'Publish Reusable Video Template'}
              </h2>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {isVi ? 'Tiêu Đề Mẫu Video *' : 'Template Title *'}
                </label>
                <input
                  required
                  type="text"
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                  placeholder={isVi ? 'VD: Mẫu Mở Đầu 3 Giây Tăng 300% Xem Cho SaaS' : 'e.g., 3-Sec Viral SaaS Hook Recipe'}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {isVi ? 'Chủ Đề (Niche)' : 'Niche'}
                  </label>
                  <select
                    value={templateForm.niche}
                    onChange={(e) => setTemplateForm({ ...templateForm, niche: e.target.value })}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="general">{isVi ? 'Tổng hợp' : 'General'}</option>
                    <option value="saas">SaaS / Công nghệ</option>
                    <option value="ecommerce">E-commerce / Thương mại điện tử</option>
                    <option value="finance">Tài chính / Crypto</option>
                    <option value="fitness">Thể hình / Đời sống</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {isVi ? 'Nền Tảng Đích' : 'Target Platform'}
                  </label>
                  <select
                    value={templateForm.targetPlatform}
                    onChange={(e) => setTemplateForm({ ...templateForm, targetPlatform: e.target.value as CreatorTemplatePlatform })}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="youtube_shorts">YouTube Shorts</option>
                    <option value="instagram_reels">Instagram Reels</option>
                    <option value="facebook_reels">Facebook Reels</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {isVi ? 'Kịch Bản Khung (Script Template) *' : 'Script Template *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={templateForm.scriptTemplate}
                  onChange={(e) => setTemplateForm({ ...templateForm, scriptTemplate: e.target.value })}
                  placeholder={isVi ? 'Nhập khung kịch bản với các biến số [SẢN PHẨM], [LỢI ÍCH]...' : 'Enter script with placeholders [PRODUCT], [BENEFIT]...'}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {isVi ? 'Prompt Phong Cách Hình Ảnh (Visual Prompt) *' : 'Visual Style Prompt *'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={templateForm.visualStylePrompt}
                  onChange={(e) => setTemplateForm({ ...templateForm, visualStylePrompt: e.target.value })}
                  placeholder={isVi ? 'VD: Cinematic 3D product render, high key lighting, 8k resolution' : 'e.g., Cinematic 3D product render, vibrant lighting'}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {isVi ? 'Giá Mẫu ($ USD)' : 'Template Price ($ USD)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={templateForm.priceDollars}
                    onChange={(e) => setTemplateForm({ ...templateForm, priceDollars: e.target.value })}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-indigo-400 mt-1 block">
                    {isVi ? 'Bạn nhận 70% trên mỗi lượt dùng' : 'You earn 70% royalty on each run'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {isVi ? 'Tỉ Lệ Khung Hình' : 'Aspect Ratio'}
                  </label>
                  <select
                    value={templateForm.aspectRatio}
                    onChange={(e) => setTemplateForm({ ...templateForm, aspectRatio: e.target.value as '9:16' | '16:9' | '1:1' })}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="9:16">9:16 (Vertical Shorts / Reels)</option>
                    <option value="16:9">16:9 (Horizontal)</option>
                    <option value="1:1">1:1 (Square)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingTemplate}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
                >
                  {submittingTemplate
                    ? isVi ? 'Đang gửi...' : 'Submitting...'
                    : isVi ? 'Gửi Duyệt Mẫu' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dual-Rail Withdrawal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-100">
                {isVi ? 'Rút Tiền Hoa Hồng (Dual-Rail)' : 'Dual-Rail Royalty Withdrawal'}
              </h2>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWithdrawal} className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-between">
                <span className="text-xs text-zinc-400">{isVi ? 'Số dư khả dụng:' : 'Available Balance:'}</span>
                <span className="font-bold text-amber-300 text-base">{formatUsd(stats.availableBalanceCents)}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {isVi ? 'Số Tiền Rút ($ USD) *' : 'Withdrawal Amount ($ USD) *'}
                </label>
                <input
                  required
                  type="number"
                  min="50"
                  step="1"
                  value={withdrawForm.amountDollars}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amountDollars: e.target.value })}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-zinc-500 mt-1 block">
                  {isVi ? 'Tối thiểu $50.00 USD' : 'Minimum withdrawal: $50.00 USD'}
                </span>
              </div>

              {/* Payout Rail Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  {isVi ? 'Chọn Cổng Nhận Tiền *' : 'Select Payout Rail *'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWithdrawForm({ ...withdrawForm, rail: 'USDT' })}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-center ${
                      withdrawForm.rail === 'USDT'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Coins className="h-5 w-5 text-cyan-400" />
                    <span className="font-semibold text-xs">USDT (TRC-20)</span>
                    <span className="text-[10px] text-zinc-500">{isVi ? 'Toàn Cầu / Web3' : 'Global / Web3'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithdrawForm({ ...withdrawForm, rail: 'VIETQR' })}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-center ${
                      withdrawForm.rail === 'VIETQR'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Building2 className="h-5 w-5 text-rose-400" />
                    <span className="font-semibold text-xs">VietQR (NAPAS 247)</span>
                    <span className="text-[10px] text-zinc-500">{isVi ? 'Ngân Hàng Nội Địa VN' : 'Vietnam Domestic Bank'}</span>
                  </button>
                </div>
              </div>

              {/* Conditional Inputs */}
              {withdrawForm.rail === 'USDT' ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {isVi ? 'Địa Chỉ Ví USDT TRC-20 *' : 'USDT TRC-20 Wallet Address *'}
                  </label>
                  <input
                    required
                    type="text"
                    value={withdrawForm.destinationAddress}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, destinationAddress: e.target.value })}
                    placeholder="T..."
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      {isVi ? 'Ngân Hàng Thụ Hưởng (NAPAS) *' : 'Beneficiary Bank (NAPAS) *'}
                    </label>
                    <select
                      value={withdrawForm.bankBin}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, bankBin: e.target.value })}
                      className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {NAPAS_BANKS.map((b) => (
                        <option key={b.bin} value={b.bin}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      {isVi ? 'Số Tài Khoản Ngân Hàng *' : 'Bank Account Number *'}
                    </label>
                    <input
                      required
                      type="text"
                      value={withdrawForm.bankAccountNumber}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, bankAccountNumber: e.target.value })}
                      placeholder="0123456789"
                      className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      {isVi ? 'Tên Chủ Tài Khoản (Không Dấu) *' : 'Account Holder Name *'}
                    </label>
                    <input
                      required
                      type="text"
                      value={withdrawForm.bankAccountName}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, bankAccountName: e.target.value.toUpperCase() })}
                      placeholder="NGUYEN VAN A"
                      className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="p-2.5 rounded bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-300">
                    <span className="text-zinc-400">{isVi ? 'Ước tính quy đổi:' : 'Est. Exchange:'} </span>
                    <span className="font-semibold text-emerald-400">
                      {(parseFloat(withdrawForm.amountDollars || '0') * 25450).toLocaleString('vi-VN')} VND
                    </span>
                    <span className="text-[10px] text-zinc-500 ml-1">(Tỉ giá 1 USD = 25,450 VND)</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdraw}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
                >
                  {submittingWithdraw
                    ? isVi ? 'Đang gửi...' : 'Processing...'
                    : isVi ? 'Xác Nhận Rút' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: VietQR Quick-Scan Viewer */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4 text-center shadow-2xl">
            <h3 className="font-bold text-base text-zinc-100">
              {isVi ? 'Mã VietQR Chuyển Khoản' : 'VietQR Transfer Code'}
            </h3>
            <p className="text-xs text-zinc-400">
              {activeQrModal.bankName} • {activeQrModal.accountNumber}
            </p>

            <div className="p-3 bg-white rounded-xl mx-auto w-fit shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeQrModal.qrUrl}
                alt="VietQR Payout"
                className="w-56 h-56 object-contain"
              />
            </div>

            <div className="text-sm font-semibold text-emerald-400">
              {activeQrModal.amountVnd.toLocaleString('vi-VN')} VND
              <span className="text-xs text-zinc-400 block font-normal">
                (${activeQrModal.amountUsd.toFixed(2)} USD)
              </span>
            </div>

            <button
              onClick={() => setActiveQrModal(null)}
              className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium"
            >
              {isVi ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
