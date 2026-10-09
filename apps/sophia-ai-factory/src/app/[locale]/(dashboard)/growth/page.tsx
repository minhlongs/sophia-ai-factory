import React from 'react';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserPredictiveJobsAction } from '@/land/growth-v14/predictive-render-actions';
import { UnifiedGrowthCockpit } from '@/components/growth/unified-growth-cockpit';
import { SignalStreamBadge } from '@/components/growth/primitives';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Trung tâm Tăng trưởng Tự động | Sophia AI Factory'
      : 'Unified Growth Operations Center | Sophia AI Factory',
    description: isVi
      ? 'Bảng điều hành tự động hóa tăng trưởng: Phân bổ ngân sách Kelly, ngắt sớm Bayesian và đối soát hiệu suất đa nền tảng.'
      : 'Autonomous growth operations: Fractional Kelly budgeting, Bayesian early-halt rendering, and cross-platform performance attribution.',
  };
}

export default async function UnifiedGrowthPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const user = await getCurrentUser();

  let initialJobs: PredictiveRenderJob[] = [];
  if (user?.id) {
    const res = await getUserPredictiveJobsAction();
    if (res.ok) {
      initialJobs = res.value;
    }
  }

  // Client-side fetcher function for telemetry polling
  async function fetchJobs(): Promise<PredictiveRenderJob[]> {
    'use server';
    const res = await getUserPredictiveJobsAction();
    return res.ok ? res.value : [];
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-800 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {isVi ? 'Trung tâm Tăng trưởng Hợp nhất' : 'Unified Growth Operations'}
            </h1>
            <SignalStreamBadge
              label={isVi ? 'Hệ thống Trực tuyến' : 'Live Ecosystem'}
              status="active"
            />
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            {isVi
              ? 'Hệ điều hành tăng trưởng tự động khép kín v12–v14: Đột biến Darwinian, MAB đa nhánh và Render dự báo bảo toàn GPU.'
              : 'Closed-loop autonomous growth OS v12–v14: Darwinian mutations, Multi-Armed Bandit testing, and GPU-preserving predictive rendering.'}
          </p>
        </div>
      </div>

      <UnifiedGrowthCockpit
        initialJobs={initialJobs}
        fetcher={fetchJobs}
        locale={locale === 'vi' ? 'vi' : 'en'}
      />
    </div>
  );
}
