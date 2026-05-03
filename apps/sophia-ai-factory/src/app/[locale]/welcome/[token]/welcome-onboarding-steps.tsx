'use client';

/**
 * Welcome page onboarding steps configuration and step components.
 * Extracted from welcome-page-client for file size compliance.
 *
 * @module app/[locale]/welcome/[token]/welcome-onboarding-steps
 */

import { CheckCircle2, Circle, ArrowRight, Key, BarChart3, Settings, Zap } from 'lucide-react';

export interface WelcomeData {
  handoverId: string;
  agencyName: string;
  agencyType: string | null;
  tier: string;
  ownerEmail: string;
  ownerFullName: string;
  installedSops: string[];
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
  status: string;
}

export interface OnboardingStep {
  id: number;
  icon: React.ReactNode;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  ctaLabel?: string;
  ctaHref?: string;
  done: boolean;
}

export function buildOnboardingSteps(data: WelcomeData, locale: string): OnboardingStep[] {
  const isVi = locale.startsWith('vi');
  return [
    {
      id: 1,
      icon: <CheckCircle2 size={20} />,
      titleVi: 'Tài khoản đã tạo',
      titleEn: 'Account Created',
      descVi: 'Sophia đã tạo tài khoản cho bạn. Nhấn "Bắt đầu" bên dưới để vào dashboard.',
      descEn: 'Sophia created your account. Click "Get Started" below to enter your dashboard.',
      done: true,
    },
    {
      id: 2,
      icon: <Key size={20} />,
      titleVi: 'Cấu hình API Keys',
      titleEn: 'Configure API Keys',
      descVi: 'Thêm HeyGen API key và Resend API key trong trang Setup Wizard.',
      descEn: 'Add your HeyGen API key and Resend API key in the Setup Wizard.',
      ctaLabel: isVi ? 'Mở Setup Wizard' : 'Open Setup Wizard',
      ctaHref: `/${locale}/setup-wizard`,
      done: false,
    },
    {
      id: 3,
      icon: <Settings size={20} />,
      titleVi: 'Xác minh HeyGen',
      titleEn: 'Verify HeyGen',
      descVi: 'Kiểm tra kết nối HeyGen trong Settings → Integrations.',
      descEn: 'Test HeyGen connection in Settings → Integrations.',
      ctaLabel: isVi ? 'Kiểm tra ngay' : 'Test Now',
      ctaHref: `/${locale}/dashboard/byok`,
      done: false,
    },
    {
      id: 4,
      icon: <Zap size={20} />,
      titleVi: 'Chạy SOP đầu tiên',
      titleEn: 'Run First SOP',
      descVi: `${data.installedSops.length > 0 ? `${data.installedSops.length} SOPs đã cài sẵn. ` : ''}Kích hoạt và chạy một SOP ngay bây giờ.`,
      descEn: `${data.installedSops.length > 0 ? `${data.installedSops.length} SOPs pre-installed. ` : ''}Enable and run a SOP now.`,
      ctaLabel: isVi ? 'Đến trang SOPs' : 'Go to SOPs',
      ctaHref: `/${locale}/dashboard/sops`,
      done: !!data.firstRunAt,
    },
    {
      id: 5,
      icon: <BarChart3 size={20} />,
      titleVi: 'Theo dõi kết quả',
      titleEn: 'Watch Results',
      descVi: 'Xem videos đã tạo, số liệu hiệu suất và MCU usage trong Dashboard.',
      descEn: 'See generated videos, performance metrics, and MCU usage in your Dashboard.',
      ctaLabel: isVi ? 'Đến Dashboard' : 'Go to Dashboard',
      ctaHref: `/${locale}/dashboard`,
      done: !!(data.firstRunAt && data.firstSopInstallAt),
    },
  ];
}

interface StepCardProps { step: OnboardingStep; isVi: boolean }

export function StepCard({ step, isVi }: StepCardProps) {
  return (
    <div className={`rounded-2xl border p-5 transition-all ${step.done ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-white/10 bg-white/[0.03] backdrop-blur-sm'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
          {step.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold ${step.done ? 'text-emerald-300' : 'text-zinc-100'}`}>
              {isVi ? step.titleVi : step.titleEn}
            </h3>
            <span className="text-xs text-zinc-600 shrink-0">Step {step.id}</span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{isVi ? step.descVi : step.descEn}</p>
          {!step.done && step.ctaLabel && step.ctaHref && (
            <a href={step.ctaHref} className="inline-flex items-center gap-1.5 mt-3 text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors">
              {step.ctaLabel}<ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
