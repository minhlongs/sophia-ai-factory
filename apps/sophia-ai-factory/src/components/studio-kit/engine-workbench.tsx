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
import { WorkbenchTabScriptPolicy } from './workbench-tab-script-policy';
import { WorkbenchTabMediaSlide } from './workbench-tab-media-slide';
import { WorkbenchTabRevenueGrowth } from './workbench-tab-revenue-growth';
import { WorkbenchTabSecurityRbac } from './workbench-tab-security-rbac';
import { WorkbenchTabR21R25Engines } from './workbench-tab-r21-r25-engines';
import { StudioCommandPalette } from './studio-command-palette';

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
      en: 'Enter a headline and key point to preview and download a crisp SVG carousel slide and prepare free browser voice chunks.',
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
      en: 'Check Frame-1 safe zones, geo-route affiliate links by country, enforce anti-burnout cadence, and split 70/20/10 payouts with zero floating-point drift.',
    },
  },
];

export function EngineWorkbench({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [activeStep, setActiveStep] = useState<StepId>('script');
  const current = STEPS.find((s) => s.id === activeStep) ?? STEPS[0];
  const nextStep = current.nextId ? STEPS.find((s) => s.id === current.nextId) : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {locale === 'vi' ? 'Quy Trình Vận Hành 4 Bước • Sophia 2026' : '4-Step Operations Flow • Sophia 2026'}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {locale === 'vi' ? 'Xưởng Vận Hành Chiến Dịch AI' : 'AI Campaign Operations Workbench'}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {locale === 'vi'
            ? 'Làm lần lượt từ Bước 1 đến Bước 4. Mọi kiểm tra đều chạy tức thì trên trình duyệt, hoàn toàn minh bạch và không tốn thêm chi phí AI.'
            : 'Follow Steps 1 to 4 in order. Every check runs instantly in your browser with full transparency and $0 extra AI cost.'}
        </p>
      </header>

      {/* Clean 5-Step Horizontal Stepper */}
      <nav aria-label={locale === 'vi' ? 'Các bước vận hành' : 'Workflow steps'} className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {STEPS.map((step) => {
          const isCurrent = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => setActiveStep(step.id)}
              className={`md3-pill-button flex items-center gap-3 border px-4 py-3 text-left ${
                isCurrent
                  ? 'border-primary bg-[var(--md-sys-color-primary-container)] text-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.num}
              </span>
              <span className="text-sm font-semibold leading-tight">{step.title[locale]}</span>
            </button>
          );
        })}
      </nav>

      {/* Transparent Purpose Banner for Active Step */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {locale === 'vi' ? `Bước ${current.num}: ${current.title.vi}` : `Step ${current.num}: ${current.title.en}`}
          </p>
          <p className="text-sm text-muted-foreground">{current.purpose[locale]}</p>
        </div>
        {nextStep ? (
          <button
            type="button"
            onClick={() => setActiveStep(nextStep.id)}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {locale === 'vi' ? `Sang Bước ${nextStep.num} →` : `Next: Step ${nextStep.num} →`}
          </button>
        ) : null}
      </div>

      {/* Active Step Workspace (MD3 Expressive Tonal Surface) */}
      <div className="md3-surface-card p-6">
        {activeStep === 'script' ? <WorkbenchTabScriptPolicy locale={locale} /> : null}
        {activeStep === 'media' ? <WorkbenchTabMediaSlide locale={locale} /> : null}
        {activeStep === 'revenue' ? <WorkbenchTabRevenueGrowth locale={locale} /> : null}
        {activeStep === 'security' ? <WorkbenchTabSecurityRbac locale={locale} /> : null}
        {activeStep === 'scale' ? <WorkbenchTabR21R25Engines locale={locale} /> : null}
      </div>

      {/* Collapsed R&D Technical Registry (Modern Web Guidance content-visibility) */}
      <details className="mwg-offscreen-section rounded-2xl border border-border bg-card/60 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
          {locale === 'vi'
            ? 'Danh mục kỹ thuật 19 động cơ AI (Dành cho R&D — bấm để mở rộng)'
            : 'Technical Registry: 19 AI Engines (For R&D — click to expand)'}
        </summary>
        <div className="mt-4">
          <StudioCommandPalette locale={locale} />
        </div>
      </details>
    </div>
  );
}
