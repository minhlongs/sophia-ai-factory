'use client';

/**
 * Welcome page client — validates magic link token, shows 5-step onboarding.
 * No auth required initially; token is consumed on "Get Started" click.
 *
 * @module app/[locale]/welcome/[token]/welcome-page-client
 */

import { useEffect, useState } from 'react';
import { Loader2, Video, Zap } from 'lucide-react';
import { buildOnboardingSteps, StepCard, type WelcomeData } from './welcome-onboarding-steps';

interface Props { token: string; isVi: boolean; locale: string }

export function WelcomePageClient({ token, isVi, locale }: Props) {
  const [data, setData] = useState<WelcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/welcome/validate/${token}`);
        if (!res.ok) {
          setError(isVi ? 'Link không hợp lệ hoặc đã hết hạn.' : 'Link is invalid or expired.');
          return;
        }
        setData(await res.json() as WelcomeData);
      } catch {
        setError(isVi ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Connection error. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isVi]);

  async function handleGetStarted() {
    setStarted(true);
    try {
      const res = await fetch(`/api/welcome/validate/${token}`, { method: 'POST' });
      const data = await res.json() as { redirectUrl?: string };
      window.location.href = data.redirectUrl ?? `/${locale}/dashboard`;
    } catch {
      window.location.href = `/${locale}/dashboard`;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-500/40 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">{isVi ? 'Link Không Hợp Lệ' : 'Invalid Link'}</h1>
          <p className="text-zinc-400 text-sm">{error ?? (isVi ? 'Link đã hết hạn hoặc đã được sử dụng.' : 'This link has expired or been used.')}</p>
          <a href={`/${locale}/login`} className="inline-block px-6 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors">
            {isVi ? 'Đến trang đăng nhập' : 'Go to Login'}
          </a>
        </div>
      </div>
    );
  }

  const steps = buildOnboardingSteps(data, locale);
  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-blue-900/10 to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto px-6 pt-16 pb-12 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs mb-6">
            <Video size={12} />
            {isVi ? `Gói ${data.tier} đã kích hoạt` : `${data.tier} Plan Activated`}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {isVi ? `Chào mừng,` : `Welcome,`}
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">{data.agencyName}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto">
            {isVi
              ? 'Tài khoản của bạn đã sẵn sàng. Hoàn thành các bước bên dưới để bắt đầu tự động hóa marketing.'
              : 'Your account is ready. Complete the steps below to start automating your marketing.'}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-6 pb-4">
        <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
          <span>{isVi ? `${completedCount} trong ${steps.length} bước` : `${completedCount} of ${steps.length} steps`}</span>
          <span className="text-violet-400 font-medium">{Math.round((completedCount / steps.length) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-500" style={{ width: `${(completedCount / steps.length) * 100}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-2xl mx-auto px-6 pb-16 space-y-4">
        {steps.map((s) => <StepCard key={s.id} step={s} isVi={isVi} />)}

        {/* CTA */}
        <div className="pt-4 text-center">
          <button
            onClick={() => void handleGetStarted()}
            disabled={started}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-lg shadow-lg shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {started ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
            {isVi ? 'Bắt đầu ngay' : 'Get Started'}
          </button>
          <p className="text-xs text-zinc-600 mt-3">
            {isVi ? 'Link này chỉ dùng 1 lần. Sau khi nhấn, bạn sẽ được chuyển đến dashboard.' : "One-time link. After clicking, you'll be redirected to your dashboard."}
          </p>
        </div>
      </div>
    </div>
  );
}
