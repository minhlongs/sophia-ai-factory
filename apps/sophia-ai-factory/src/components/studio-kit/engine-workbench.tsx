'use client';

/**
 * Sophia AI Factory — Guided 4-Step Operations Workbench (Zen Design OS 2026).
 *
 * Designed for non-technical CEOs & operators:
 * - Linear 4-step workflow with plain-language purpose & clear Next Step CTA.
 * - Uses Zen Design OS semantic tokens (`bg-card`, `border-border`, `text-foreground`).
 * - Collapses the 19-engine technical R&D Inspector by default to eliminate clutter.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ComplianceJurisdiction, CompliancePlatform } from '@/seed/compliance/policy-preflight-engine';
import { Md3SegmentedGroup, Md3SurfaceCard } from '@/components/md3/md3-primitives';
import { DEFAULT_WORKBENCH_SCRIPT, WorkbenchTabScriptPolicy } from './workbench-tab-script-policy';
import { StudioCommandPalette } from './studio-command-palette';

const TabSkeleton = () => (
  <div className="min-h-[240px] animate-pulse rounded-2xl bg-muted/40" aria-busy="true" />
);

const WorkbenchTabMediaSlide = dynamic(
  () => import('./workbench-tab-media-slide').then((m) => m.WorkbenchTabMediaSlide),
  { loading: TabSkeleton },
);
const WorkbenchTabRevenueGrowth = dynamic(
  () => import('./workbench-tab-revenue-growth').then((m) => m.WorkbenchTabRevenueGrowth),
  { loading: TabSkeleton },
);
const WorkbenchTabSecurityRbac = dynamic(
  () => import('./workbench-tab-security-rbac').then((m) => m.WorkbenchTabSecurityRbac),
  { loading: TabSkeleton },
);
const WorkbenchTabR21R25Engines = dynamic(
  () => import('./workbench-tab-r21-r25-engines').then((m) => m.WorkbenchTabR21R25Engines),
  { loading: TabSkeleton },
);

type StepId = 'script' | 'media' | 'revenue' | 'security' | 'scale';

interface StepMeta {
  readonly id: StepId;
  readonly num: number;
  readonly title: { readonly vi: string; readonly en: string };
  readonly purpose: { readonly vi: string; readonly en: string };
  readonly nextId?: StepId;
}

const STEPS: readonly StepMeta[] = [
  {
    id: 'script',
    num: 1,
    title: { vi: 'Kiểm Tra Kịch Bản', en: 'Check Script' },
    purpose: {
      vi: 'Dán kịch bản để hệ thống tự kiểm tra luật sàn (TikTok/YouTube/Crypto), chấm điểm 3 giây mở đầu và tách bài đăng đa kênh trước khi quay.',
      en: 'Paste your script to verify platform/regulatory rules, score the 3-second hook, and split posts for X/Telegram/Reddit before filming.',
    },
    nextId: 'media',
  },
  {
    id: 'media',
    num: 2,
    title: { vi: 'Tạo Slide & Giọng Đọc', en: 'Create Slide & Voice' },
    purpose: {
      vi: 'Nhập tiêu đề & ý chính để tạo ảnh slide Carousel sắc nét tải về ngay, đồng thời chia đoạn giọng đọc miễn phí ngay trên trình duyệt.',
      en: 'Enter a headline and key point to preview and download a crisp carousel slide and generate free voiceover segments in your browser.',
    },
    nextId: 'revenue',
  },
  {
    id: 'revenue',
    num: 3,
    title: { vi: 'Tối Ưu Doanh Thu', en: 'Optimize Revenue' },
    purpose: {
      vi: 'So sánh 2 mẫu video để chọn mẫu ra nhiều hoa hồng hơn, phát hiện sớm link tụt doanh thu bất thường và gom nỗi đau từ bình luận khách hàng.',
      en: 'Compare two creative variants to pick the higher-converting winner, detect sudden EPC drops, and mine buyer pain points from comments.',
    },
    nextId: 'security',
  },
  {
    id: 'security',
    num: 4,
    title: { vi: 'Khóa Link & Chặn Bot', en: 'Lock Links & Block Bots' },
    purpose: {
      vi: 'Kiểm tra quyền nhân viên (VA được sửa kịch bản nhưng bị khóa cứng link hoa hồng của bạn) và chặn bot click ảo làm sai lệch báo cáo.',
      en: 'Verify team permissions (VA editors can edit scripts while your affiliate links stay locked) and filter bot/datacenter clicks.',
    },
    nextId: 'scale',
  },
  {
    id: 'scale',
    num: 5,
    title: { vi: 'Mở Rộng & Chia Hoa Hồng', en: 'Scale & Revenue Split' },
    purpose: {
      vi: 'Kiểm tra vùng an toàn khung hình đầu, chuyển hướng link theo quốc gia (VN/US/UK), giữ nhịp đăng bài chống spam và chia hoa hồng 70/20/10 chính xác từng cent.',
      en: 'Check first-frame safe zones, route affiliate links by country, keep a spam-safe posting pace, and split 70/20/10 payouts to the exact cent.',
    },
  },
];

export function EngineWorkbench({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [activeStep, setActiveStep] = useState<StepId>('script');
  const [scriptDraft, setScriptDraft] = useState<string>(DEFAULT_WORKBENCH_SCRIPT);
  const [platformDraft, setPlatformDraft] = useState<CompliancePlatform>('tiktok');
  const [jurisdictionDraft, setJurisdictionDraft] = useState<ComplianceJurisdiction>('VN');
  const current = STEPS.find((s) => s.id === activeStep) ?? STEPS[0];
  const nextStep = current.nextId ? STEPS.find((s) => s.id === current.nextId) : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-text">
          {locale === 'vi' ? 'Quy Trình Vận Hành 5 Bước • Sophia 2026' : '5-Step Campaign Workflow • Sophia 2026'}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {locale === 'vi' ? 'Xưởng Vận Hành Chiến Dịch AI' : 'AI Campaign Operations Workbench'}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {locale === 'vi'
            ? 'Làm lần lượt từ Bước 1 đến Bước 5. Mọi kiểm tra đều chạy tức thì trên trình duyệt, hoàn toàn minh bạch và không tốn thêm chi phí AI.'
            : 'Follow Steps 1 to 5 in order. Every check runs instantly in your browser with full transparency and $0 extra AI cost.'}
        </p>
      </header>

      {/* Connected MD3 Expressive Segmented Stepper */}
      <Md3SegmentedGroup
        ariaLabel={locale === 'vi' ? 'Các bước vận hành' : 'Workflow steps'}
        value={activeStep}
        onChange={setActiveStep}
        options={STEPS.map((s) => ({ id: s.id, badge: s.num, label: s.title[locale] }))}
      />

      {/* Transparent Purpose Banner for Active Step */}
      <div className="md3-surface-tonal flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">
            {locale === 'vi' ? `Bước ${current.num}: ${current.title.vi}` : `Step ${current.num}: ${current.title.en}`}
          </p>
          <p className="text-sm text-muted-foreground">{current.purpose[locale]}</p>
        </div>
        {nextStep ? (
          <button
            type="button"
            onClick={() => setActiveStep(nextStep.id)}
            className="md3-pill-button min-h-[44px] shrink-0 bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm"
          >
            {locale === 'vi' ? `Sang Bước ${nextStep.num} →` : `Next: Step ${nextStep.num} →`}
          </button>
        ) : null}
      </div>

      {/* Active Step Workspace (MD3 Expressive Tonal Surface + Container Query) */}
      <Md3SurfaceCard className="md3-container">
        {activeStep === 'script' ? (
          <WorkbenchTabScriptPolicy
            locale={locale}
            script={scriptDraft}
            onScriptChange={setScriptDraft}
            platform={platformDraft}
            onPlatformChange={setPlatformDraft}
            jurisdiction={jurisdictionDraft}
            onJurisdictionChange={setJurisdictionDraft}
          />
        ) : null}
        {activeStep === 'media' ? <WorkbenchTabMediaSlide locale={locale} /> : null}
        {activeStep === 'revenue' ? <WorkbenchTabRevenueGrowth locale={locale} /> : null}
        {activeStep === 'security' ? <WorkbenchTabSecurityRbac locale={locale} /> : null}
        {activeStep === 'scale' ? <WorkbenchTabR21R25Engines locale={locale} /> : null}
      </Md3SurfaceCard>

      {/* Always-Visible MD3 34-Engine Catalog (Zero Hidden Features) */}
      <div className="[content-visibility:auto] [contain-intrinsic-size:1px_640px]">
        <StudioCommandPalette
          locale={locale}
          campaignDraft={{
            script: scriptDraft,
            platform:
              platformDraft === 'tiktok' || platformDraft === 'youtube_shorts' || platformDraft === 'instagram_reels'
                ? platformDraft
                : 'tiktok',
            region:
              jurisdictionDraft === 'VN' || jurisdictionDraft === 'US' || jurisdictionDraft === 'UK' || jurisdictionDraft === 'SG'
                ? jurisdictionDraft
                : 'US',
          }}
        />
      </div>
    </div>
  );
}
