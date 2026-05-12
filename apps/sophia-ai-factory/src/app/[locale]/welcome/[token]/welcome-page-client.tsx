'use client';

/**
 * Welcome page client — validates magic link token, shows 5-step onboarding.
 * No auth required initially; token is consumed on "Get Started" click.
 *
 * Includes "Connect Telegram" CTA that generates a pairing token and opens
 * t.me/Sophia_Bbot?start=<token> in a new tab.
 *
 * @module app/[locale]/welcome/[token]/welcome-page-client
 */

import { useEffect, useState } from 'react';
import { Loader2, Video, Zap, AlertTriangle, Mail, CheckCircle2, MessageCircle } from 'lucide-react';
import { buildOnboardingSteps, StepCard, type WelcomeData } from './welcome-onboarding-steps';
import { generateTelegramPairingTokenAction } from '@/app/actions/generate-telegram-pairing-token';

const BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'Sophia_Bbot').replace(/^@/, '').trim();

interface Props { token: string; isVi: boolean; locale: string }

export function WelcomePageClient({ token, isVi, locale }: Props) {
  const [data, setData] = useState<WelcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);

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

  async function handleConnectTelegram() {
    setTelegramLinking(true);
    try {
      const { token: pairingToken } = await generateTelegramPairingTokenAction();
      const botUrl = `https://t.me/${BOT_USERNAME}?start=${pairingToken}`;
      window.open(botUrl, '_blank', 'noopener,noreferrer');
      setTelegramLinked(true);
    } catch (err) {
      console.error('[welcome] Telegram connect failed:', err);
    } finally {
      setTelegramLinking(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 aria-hidden="true" size={32} className="animate-spin text-violet-400" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (error || !data) {
    return <InvalidLinkView locale={locale} isVi={isVi} message={error} />;
  }

  const steps = buildOnboardingSteps(data, locale);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-blue-900/10 to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto px-6 pt-16 pb-10 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs mb-6">
            <Video aria-hidden="true" size={12} />
            {isVi ? `Gói ${data.tier} đã kích hoạt` : `${data.tier} Plan Activated`}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {isVi ? `Chào mừng,` : `Welcome,`}
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">{data.agencyName}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto mb-8">
            {isVi
              ? 'Tài khoản đã sẵn sàng. Nhấn nút bên dưới để vào Setup Wizard cấu hình API keys.'
              : 'Your account is ready. Click below to enter the Setup Wizard and configure your API keys.'}
          </p>

          {/* Primary CTA — surfaced first, no fake progress bar */}
          <button
            onClick={() => void handleGetStarted()}
            disabled={started}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-lg shadow-lg shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors transition-opacity focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
          >
            {started ? <Loader2 aria-hidden="true" size={20} className="animate-spin" /> : <Zap aria-hidden="true" size={20} />}
            {isVi ? 'Bắt đầu ngay' : 'Get Started'}
          </button>
          <p className="text-xs text-zinc-600 mt-3">
            {isVi ? 'Link này chỉ dùng 1 lần.' : 'This link is single-use.'}
          </p>
        </div>
      </div>

      {/* Telegram CTA */}
      <div className="max-w-2xl mx-auto px-6 pb-8">
        <div className="rounded-2xl border border-blue-500/30 bg-blue-900/10 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <MessageCircle aria-hidden="true" size={20} className="text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-zinc-100 mb-1">
                {isVi ? 'Kết nối Telegram' : 'Connect Telegram'}
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                {isVi
                  ? 'Nhận thông báo + lệnh nhanh ngay trên Telegram. Gõ /campaign để tạo video bất cứ lúc nào.'
                  : 'Get notifications + quick commands on Telegram. Type /campaign to create videos anytime.'}
              </p>
              {telegramLinked ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 aria-hidden="true" size={16} />
                  {isVi ? '✅ Đã mở Telegram — gõ /start để hoàn tất kết nối' : '✅ Telegram opened — type /start to complete linking'}
                </div>
              ) : (
                <button
                  onClick={() => void handleConnectTelegram()}
                  disabled={telegramLinking}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none"
                >
                  {telegramLinking
                    ? <Loader2 aria-hidden="true" size={16} className="animate-spin" />
                    : <MessageCircle aria-hidden="true" size={16} />}
                  {isVi ? 'Mở Telegram và kết nối' : 'Open Telegram and connect'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap preview — informational, not a progress checklist */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        <h2 className="text-sm font-medium text-zinc-400 mb-4 text-center uppercase tracking-wider">
          {isVi ? 'Lộ trình kích hoạt' : 'Activation Roadmap'}
        </h2>
        <div className="space-y-3">
          {steps.map((s) => <StepCard key={s.id} step={s} isVi={isVi} />)}
        </div>
      </div>
    </div>
  );
}

/**
 * Invalid / expired magic link view with built-in self-resend form.
 * Calls /api/welcome/resend so the customer can recover without admin help.
 */
function InvalidLinkView({
  locale,
  isVi,
  message,
}: {
  locale: string;
  isVi: boolean;
  message: string | null;
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResendError(null);
    try {
      const res = await fetch('/api/welcome/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 429) {
        setResendError(
          isVi
            ? 'Anh/chị đã yêu cầu quá nhanh. Thử lại sau 1 giờ.'
            : 'Too many requests. Please try again in an hour.',
        );
        return;
      }
      if (!res.ok) {
        setResendError(isVi ? 'Có lỗi xảy ra.' : 'Something went wrong.');
        return;
      }
      setSent(true);
    } catch {
      setResendError(isVi ? 'Lỗi kết nối.' : 'Connection error.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div aria-live="polite" className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-900/30 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle2 aria-hidden="true" size={28} className="text-emerald-300" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            {isVi ? 'Đã gửi link mới' : 'New link sent'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {isVi
              ? 'Nếu email tồn tại trong hệ thống, anh/chị sẽ nhận link đăng nhập mới trong vài phút.'
              : "If that email is in our system, you'll receive a new sign-in link in a few minutes."}
          </p>
          <a
            href={`/${locale}`}
            className="inline-block px-6 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
          >
            {isVi ? 'Về trang chủ' : 'Back to home'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-zinc-900/80 backdrop-blur border border-red-500/30 rounded-2xl p-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle aria-hidden="true" size={26} className="text-red-300" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100">
              {isVi ? 'Link không hợp lệ' : 'Invalid Link'}
            </h1>
            <p className="text-sm text-zinc-400">
              {message ?? (isVi ? 'Link đã hết hạn hoặc đã được sử dụng.' : 'This link has expired or been used.')}
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-5 space-y-3">
            <p className="text-sm text-zinc-300 text-center">
              {isVi ? 'Nhập email để nhận link mới' : 'Enter your email to get a new link'}
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/40">
                <Mail aria-hidden="true" size={16} className="text-zinc-500 flex-shrink-0" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="email@congty.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-sm"
                  maxLength={200}
                />
              </div>

              {resendError && (
                <p role="alert" aria-live="polite" className="text-xs text-red-300 text-center">{resendError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
              >
                {submitting ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : null}
                {isVi ? 'Gửi link mới' : 'Send new link'}
              </button>
            </form>
          </div>

          <a
            href={`/${locale}/login`}
            className="block text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isVi ? 'Hoặc đăng nhập bằng tài khoản đã có' : 'Or sign in with existing account'}
          </a>
        </div>
      </div>
    </div>
  );
}
