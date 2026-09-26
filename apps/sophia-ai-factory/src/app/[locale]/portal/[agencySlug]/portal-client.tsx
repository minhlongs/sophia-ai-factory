'use client';

/**
 * 100% White-Label Client Portal Interactive UI
 *
 * Layer: land (Client Component)
 * Zero vendor leakage — all branding, typography, and accents use agency theme tokens.
 */

import React, { useState } from 'react';
import type { UnbrandedAgencyPortalConfig } from '@/tree/partners/whitelabel-portal';

interface PortalClientProps {
  agency: UnbrandedAgencyPortalConfig;
  locale: string;
  isVi: boolean;
}

interface VideoDeliverable {
  id: string;
  title: string;
  platform: 'TikTok' | 'YouTube Shorts' | 'Reels';
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  status: 'ready' | 'rendering' | 'review';
  createdAt: string;
  thumbnailColor: string;
}

export function PortalClient({ agency, locale, isVi }: PortalClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'studio' | 'support'>('overview');
  const [selectedRatio, setSelectedRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [selectedLang, setSelectedLang] = useState<string>(isVi ? 'VI' : 'EN');
  const [promptInput, setPromptInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [deliverables, setDeliverables] = useState<VideoDeliverable[]>([
    {
      id: 'vid-101',
      title: isVi ? 'Chiến dịch Ra mắt Sản phẩm Mùa Thu' : 'Autumn Product Launch Campaign',
      platform: 'TikTok',
      duration: '0:35',
      aspectRatio: '9:16',
      status: 'ready',
      createdAt: isVi ? 'Hôm nay, 09:30' : 'Today, 09:30 AM',
      thumbnailColor: '#1e293b',
    },
    {
      id: 'vid-102',
      title: isVi ? 'Video Đánh giá Khách hàng & Feedback' : 'Customer Review & Testimonial Reel',
      platform: 'Reels',
      duration: '0:45',
      aspectRatio: '9:16',
      status: 'ready',
      createdAt: isVi ? 'Hôm qua' : 'Yesterday',
      thumbnailColor: '#0f172a',
    },
    {
      id: 'vid-103',
      title: isVi ? 'Video Giới thiệu Tính năng Công nghệ' : 'Tech Feature Explainer Shorts',
      platform: 'YouTube Shorts',
      duration: '0:58',
      aspectRatio: '16:9',
      status: 'rendering',
      createdAt: isVi ? '2 ngày trước' : '2 days ago',
      thumbnailColor: '#334155',
    },
  ]);

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newVid: VideoDeliverable = {
        id: `vid-${Date.now().toString().slice(-4)}`,
        title: promptInput.trim(),
        platform: selectedRatio === '9:16' ? 'TikTok' : selectedRatio === '16:9' ? 'YouTube Shorts' : 'Reels',
        duration: '0:30',
        aspectRatio: selectedRatio,
        status: 'rendering',
        createdAt: isVi ? 'Vừa xong' : 'Just now',
        thumbnailColor: '#1e293b',
      };
      setDeliverables([newVid, ...deliverables]);
      setPromptInput('');
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    }, 800);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          {agency.logoUrl ? (
            <img
              src={agency.logoUrl}
              alt={agency.brandName}
              className="h-9 max-w-[180px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm"
                style={{ backgroundColor: 'var(--brand-primary, #06b6d4)' }}
              >
                {agency.brandName.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                {agency.brandName}
              </span>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
              {agency.portalTitle}
            </span>
          </div>
        </div>

        {/* Center / Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVi ? 'Tổng quan' : 'Overview'}
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'campaigns'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVi ? 'Chiến dịch & Video' : 'Campaigns & Videos'}
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'studio'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVi ? 'Studio Sáng tạo' : 'Creative Studio'}
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'support'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVi ? 'Hỗ trợ' : 'Support'}
          </button>
        </nav>

        {/* Right Controls: Locale & Account */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
            <a
              href={`/en/portal/${agency.agencySlug}`}
              className={`px-2 py-1 rounded transition-colors ${
                !isVi ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EN
            </a>
            <a
              href={`/vi/portal/${agency.agencySlug}`}
              className={`px-2 py-1 rounded transition-colors ${
                isVi ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              VI
            </a>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div
              className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300"
              title={isVi ? 'Tài khoản khách hàng' : 'Client Account'}
            >
              CL
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Banner Section */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-cyan-400 border border-slate-700/60">
              <span className="w-2 h-2 rounded-full animate-pulse bg-cyan-400" />
              {isVi ? 'Hệ Thống Sáng Tạo Đang Hoạt Động' : 'AI Production Engine Active'}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              {agency.loginHeadline ||
                (isVi
                  ? `Chào mừng đến với Cổng Sản Xuất Video của ${agency.brandName}`
                  : `Welcome to the ${agency.brandName} Creative Portal`)}
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              {agency.loginSubheading ||
                (isVi
                  ? 'Theo dõi tiến độ bàn giao video ngắn, quản lý chiến dịch đa nền tảng và khởi tạo yêu cầu sản xuất nội dung tức thì.'
                  : 'Track short-form video deliverables, manage multi-platform campaigns, and launch autonomous video requests with high-fidelity voice dubbing.')}
            </p>
          </div>
        </section>

        {/* 3. Metric KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isVi ? 'Chiến dịch Đang chạy' : 'Active Campaigns'}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">8</div>
            <div className="text-xs text-emerald-400 font-medium">
              {isVi ? '✓ 100% Đúng tiến độ' : '✓ 100% On Schedule'}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isVi ? 'Video Bàn giao' : 'Videos Rendered'}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{deliverables.length + 124}</div>
            <div className="text-xs text-slate-400">
              {isVi ? '+18 video trong tháng này' : '+18 this month'}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isVi ? 'Hạn mức MCU Còn lại' : 'MCU Compute Quota'}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">6,850</div>
            <div className="text-xs text-cyan-400 font-medium">
              {isVi ? '68.5% Dung lượng khả dụng' : '68.5% Available'}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isVi ? 'Trạng thái Dịch vụ' : 'Service SLA Status'}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400">99.9%</div>
            <div className="text-xs text-emerald-500 font-medium">
              {isVi ? 'Edge Node 0ms Độ trễ' : 'Edge Node 0ms Latency'}
            </div>
          </div>
        </section>

        {/* 4. Tab Views */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Video Request Form */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isVi ? 'Yêu Cầu Sản Xuất Video Nhanh' : 'Quick Video Production Request'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    {isVi
                      ? 'Nhập kịch bản hoặc ý tưởng video, hệ thống tự động lồng tiếng và sinh phụ đề đa ngữ.'
                      : 'Input your video prompt or hook script. The automated pipeline generates localized audio and captions.'}
                  </p>
                </div>
              </div>

              {submitSuccess && (
                <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-sm flex items-center gap-2">
                  <span>✓</span>
                  {isVi
                    ? 'Yêu cầu sản xuất video đã được tiếp nhận và đưa vào hàng đợi xử lý!'
                    : 'Video request queued successfully into the production pipeline!'}
                </div>
              )}

              <form onSubmit={handleCreateVideo} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    {isVi ? 'Ý tưởng / Hook Kịch bản' : 'Video Prompt / Hook Script'}
                  </label>
                  <textarea
                    rows={3}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder={
                      isVi
                        ? 'Ví dụ: 3 Sai lầm khiến chiến dịch quảng cáo TikTok Shorts không đạt chuyển đổi...'
                        : 'e.g. 3 critical mistakes that kill your TikTok Shorts conversion rates in 2026...'
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      {isVi ? 'Tỷ lệ Khung hình' : 'Aspect Ratio'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setSelectedRatio(ratio)}
                          className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                            selectedRatio === ratio
                              ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      {isVi ? 'Ngôn ngữ Lồng tiếng & Phụ đề' : 'Voice Dubbing & Subtitles'}
                    </label>
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="VI">Tiếng Việt (Vietnamese)</option>
                      <option value="EN">English (US)</option>
                      <option value="JA">日本語 (Japanese)</option>
                      <option value="KO">한국어 (Korean)</option>
                      <option value="TH">ไทย (Thai)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !promptInput.trim()}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
                    style={{ backgroundColor: 'var(--brand-primary, #06b6d4)' }}
                  >
                    {isSubmitting
                      ? (isVi ? 'Đang gửi...' : 'Submitting...')
                      : (isVi ? 'Khởi Tạo Video' : 'Generate Video')}
                  </button>
                </div>
              </form>
            </section>

            {/* Video Deliverables Table */}
            <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">
                    {isVi ? 'Sản Phẩm Video Mới Bàn Giao' : 'Recent Video Deliverables'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isVi
                      ? 'Tải về video chất lượng cao (1080p) hoặc sao chép liên kết chia sẻ cho chiến dịch.'
                      : 'Download full HD (1080p) assets or copy direct links for client campaigns.'}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80">
                {deliverables.map((vid) => (
                  <div
                    key={vid.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className="w-12 h-14 rounded-lg flex items-center justify-center font-bold text-xs text-slate-400 shrink-0 border border-slate-700/60"
                        style={{ backgroundColor: vid.thumbnailColor }}
                      >
                        {vid.aspectRatio}
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-slate-200">
                          {vid.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-medium text-slate-300">{vid.platform}</span>
                          <span>•</span>
                          <span>{vid.duration}</span>
                          <span>•</span>
                          <span>{vid.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          vid.status === 'ready'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                        }`}
                      >
                        {vid.status === 'ready'
                          ? (isVi ? 'Hoàn thành' : 'Ready')
                          : (isVi ? 'Đang render' : 'Rendering')}
                      </span>

                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        onClick={() => alert(isVi ? `Đang chuẩn bị tải về: ${vid.title}` : `Preparing download for: ${vid.title}`)}
                      >
                        {isVi ? 'Tải HD' : 'Download HD'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Campaigns & Videos */}
        {activeTab === 'campaigns' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-bold text-white">
              {isVi ? 'Danh Sách Chiến Dịch & Video Hoàn Thiện' : 'Campaigns & Deliverables'}
            </h2>
            <p className="text-sm text-slate-400">
              {isVi
                ? `Toàn bộ sản phẩm truyền thông được sản xuất và bảo hộ bản quyền dưới sự quản lý của ${agency.brandName}.`
                : `All creative deliverables produced and managed exclusively under the ${agency.brandName} brand.`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {deliverables.map((vid) => (
                <div
                  key={vid.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div
                    className="w-full h-36 rounded-lg flex items-center justify-center font-bold text-slate-400 text-sm border border-slate-800"
                    style={{ backgroundColor: vid.thumbnailColor }}
                  >
                    ▶ {vid.platform} — {vid.aspectRatio}
                  </div>
                  <div className="font-semibold text-sm text-slate-200 line-clamp-1">
                    {vid.title}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-900">
                    <span>{vid.duration}</span>
                    <span className="text-emerald-400 font-semibold">{vid.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab 3: Creative Studio */}
        {activeTab === 'studio' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-bold text-white">
              {isVi ? 'Phòng Sáng Tạo Video Trực Quan' : 'Visual Creative Studio'}
            </h2>
            <p className="text-sm text-slate-400">
              {isVi
                ? 'Công cụ dựng video đa nền tảng với tính năng trích xuất âm thanh, dịch thuật và lồng tiếng tự động 5 ngôn ngữ.'
                : 'Automated video studio with audio extraction, neural translation, and 5-language dubbing.'}
            </p>
            <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl space-y-2">
              <div className="text-3xl">🎬</div>
              <div className="font-semibold text-slate-300">
                {isVi ? 'Kéo thả kịch bản hoặc video mẫu vào đây' : 'Drop video brief or template here'}
              </div>
              <p className="text-xs text-slate-500">
                {isVi ? 'Hỗ trợ định dạng MP4, MOV, SRT, VTT (Tối đa 500MB)' : 'Supports MP4, MOV, SRT, VTT (Max 500MB)'}
              </p>
            </div>
          </section>
        )}

        {/* Tab 4: Support */}
        {activeTab === 'support' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-bold text-white">
              {isVi ? 'Trung Tâm Hỗ Trợ Khách Hàng' : 'Client Support & Account Executive'}
            </h2>
            <p className="text-sm text-slate-400">
              {isVi
                ? `Đội ngũ hỗ trợ chuyên biệt của ${agency.brandName} luôn sẵn sàng đồng hành cùng bạn 24/7.`
                : `Dedicated account executive and support team by ${agency.brandName} available 24/7.`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  {isVi ? 'Email Hỗ trợ Trực tiếp' : 'Direct Support Email'}
                </div>
                <div className="text-base font-bold text-white">
                  {agency.customEmailSender ||
                    (agency.customDomain ? `support@${agency.customDomain}` : 'support@agencybrand.com')}
                </div>
                <p className="text-xs text-slate-400">
                  {isVi
                    ? 'Thời gian phản hồi cam kết trong vòng 30 phút đối với khách hàng doanh nghiệp.'
                    : 'Guaranteed 30-minute response time for enterprise tier accounts.'}
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  {isVi ? 'Cổng Hỗ trợ & Tài liệu' : 'Help Center & Documentation'}
                </div>
                <div className="text-base font-bold text-white">
                  {agency.supportUrl ? (
                    <a
                      href={agency.supportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-cyan-300"
                    >
                      {agency.supportUrl}
                    </a>
                  ) : (
                    agency.customDomain ? `https://${agency.customDomain}/support` : 'Help Desk'
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {isVi
                    ? 'Truy cập tài liệu hướng dẫn và kho mẫu video chiến dịch.'
                    : 'Access knowledge base, video template blueprints, and API guides.'}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* 5. Unbranded Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-4 sm:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            {agency.footerHtml ? (
              <div dangerouslySetInnerHTML={{ __html: agency.footerHtml }} />
            ) : (
              <span>
                © {currentYear} {agency.brandName}. {isVi ? 'Bảo lưu mọi quyền.' : 'All rights reserved.'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              {isVi ? 'Cổng Khách Hàng Bảo Mật' : 'Secure Client Portal'}
            </span>
            {agency.customDomain && (
              <>
                <span>•</span>
                <span className="text-slate-400">{agency.customDomain}</span>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
