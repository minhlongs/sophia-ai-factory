'use client';

/**
 * Welcome page onboarding steps configuration and step components.
 * Steps are PURELY informational — no CTAs (token not yet consumed at this stage).
 * Extracted from welcome-page-client for file size compliance.
 *
 * @module app/[locale]/welcome/[token]/welcome-onboarding-steps
 */

import { CheckCircle2, Circle, Key, BarChart3, Settings, Zap } from 'lucide-react';

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
  done: boolean;
}

export function buildOnboardingSteps(data: WelcomeData, _locale: string): OnboardingStep[] {
  return [
    {
      id: 1,
      icon: <CheckCircle2 aria-hidden="true" size={20} />,
      titleVi: 'Tài khoản đã tạo',
      titleEn: 'Account Created',
      descVi: 'Sophia đã tạo tài khoản cho bạn. Nhấn "Bắt đầu" bên dưới để vào dashboard.',
      descEn: 'Sophia created your account. Click "Get Started" below to enter your dashboard.',
      done: true,
    },
    {
      id: 2,
      icon: <Key aria-hidden="true" size={20} />,
      titleVi: 'Cấu hình API Keys',
      titleEn: 'Configure API Keys',
      descVi: 'Thêm HeyGen API key và Resend API key trong trang Setup Wizard.',
      descEn: 'Add your HeyGen API key and Resend API key in the Setup Wizard.',
      done: false,
    },
    {
      id: 3,
      icon: <Settings aria-hidden="true" size={20} />,
      titleVi: 'Xác minh HeyGen',
      titleEn: 'Verify HeyGen',
      descVi: 'Kiểm tra kết nối HeyGen trong Settings → Integrations.',
      descEn: 'Test HeyGen connection in Settings → Integrations.',
      done: false,
    },
    {
      id: 4,
      icon: <Zap aria-hidden="true" size={20} />,
      titleVi: 'Chạy SOP đầu tiên',
      titleEn: 'Run First SOP',
      descVi: `${data.installedSops.length > 0 ? `${data.installedSops.length} SOPs đã cài sẵn. ` : ''}Kích hoạt và chạy một SOP ngay bây giờ.`,
      descEn: `${data.installedSops.length > 0 ? `${data.installedSops.length} SOPs pre-installed. ` : ''}Enable and run a SOP now.`,
      done: !!data.firstRunAt,
    },
    {
      id: 5,
      icon: <BarChart3 aria-hidden="true" size={20} />,
      titleVi: 'Theo dõi kết quả',
      titleEn: 'Watch Results',
      descVi: 'Xem videos đã tạo, số liệu hiệu suất và MCU usage trong Dashboard.',
      descEn: 'See generated videos, performance metrics, and MCU usage in your Dashboard.',
      done: !!(data.firstRunAt && data.firstSopInstallAt),
    },
  ];
}

interface StepCardProps { step: OnboardingStep; isVi: boolean }

export function StepCard({ step, isVi }: StepCardProps) {
  return (
    <div className={`rounded-2xl border p-5 transition-colors ${step.done ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-white/10 bg-white/[0.03] backdrop-blur-sm'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
          {step.done ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold ${step.done ? 'text-emerald-300' : 'text-zinc-100'}`}>
              {isVi ? step.titleVi : step.titleEn}
            </h3>
            <span className="text-xs text-zinc-600 shrink-0">{isVi ? 'Bước' : 'Step'} {step.id}</span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{isVi ? step.descVi : step.descEn}</p>
        </div>
      </div>
    </div>
  );
}
