'use client';

/**
 * Redeem page client — form for free promo codes (FREE100 etc).
 * Submits to /api/promo/redeem-free, shows the magic link on success.
 *
 * @module app/[locale]/redeem/redeem-page-client
 */

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Gift, Mail, ArrowRight } from 'lucide-react';

interface Props {
  locale: string;
  isVi: boolean;
  initialCode: string;
}

interface RedeemSuccess {
  success: true;
  redemptionId: string;
  magicLink?: string | null;
  handoverId?: string;
  trialDaysGranted?: number;
}

interface RedeemError {
  error: string;
  reason?: string;
  hint?: string;
}

export function RedeemPageClient({ locale: _locale, isVi, initialCode }: Props) {
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<RedeemSuccess | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/promo/redeem-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          fullName: fullName.trim() || undefined,
          tier: 'MASTER',
          locale: isVi ? 'vi' : 'en',
        }),
      });

      const data = (await res.json()) as RedeemSuccess | RedeemError;

      if (!res.ok || !('success' in data)) {
        const err = data as RedeemError;
        const reason = err.reason ?? err.error;
        setErrorMsg(translateReason(reason, isVi) ?? err.hint ?? (isVi ? 'Có lỗi xảy ra. Vui lòng thử lại.' : 'Something went wrong. Please try again.'));
        return;
      }

      setSuccess(data);
    } catch {
      setErrorMsg(isVi ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <SuccessView locale={_locale} isVi={isVi} email={email} magicLink={success.magicLink ?? null} />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-blue-900/10 to-transparent pointer-events-none" />
      <div className="relative max-w-md w-full">
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-600/20 border border-violet-500/30">
            <Gift size={26} className="text-violet-300" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {isVi ? 'Kích Hoạt Mã Quà Tặng' : 'Redeem Promo Code'}
          </h1>
          <p className="text-sm text-zinc-400 text-center mb-6">
            {isVi
              ? 'Nhập email và mã của bạn — chúng tôi sẽ tạo tài khoản và gửi link đăng nhập.'
              : 'Enter your email and code — we’ll create the account and email a sign-in link.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={isVi ? 'Mã quà tặng' : 'Promo code'}>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="FREE100"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 font-mono uppercase tracking-wider focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                maxLength={30}
              />
            </Field>

            <Field label={isVi ? 'Email' : 'Email'}>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="ban@congty.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                maxLength={200}
              />
            </Field>

            <Field label={isVi ? 'Tên (không bắt buộc)' : 'Name (optional)'}>
              <input
                type="text"
                autoComplete="name"
                placeholder={isVi ? 'Anh/chị Nguyễn Văn A' : 'Your name'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                maxLength={100}
              />
            </Field>

            {errorMsg && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !code || !email}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isVi ? 'Kích hoạt ngay' : 'Redeem now'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-zinc-600 text-center mt-6">
            {isVi
              ? 'Bằng việc tiếp tục, anh/chị đồng ý với điều khoản dịch vụ của Sophia AI Factory.'
              : 'By continuing, you agree to Sophia AI Factory’s terms of service.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SuccessView({
  locale: _locale,
  isVi,
  email,
  magicLink,
}: {
  locale: string;
  isVi: boolean;
  email: string;
  magicLink: string | null;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-blue-900/10 to-transparent pointer-events-none" />
      <div className="relative max-w-md w-full">
        <div className="bg-zinc-900/80 backdrop-blur border border-emerald-500/30 rounded-2xl shadow-xl p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-600/20 border border-emerald-500/30">
            <CheckCircle2 size={30} className="text-emerald-300" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isVi ? 'Kích hoạt thành công!' : 'Redemption successful!'}
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            {isVi
              ? 'Anh/chị kiểm tra email — chúng tôi vừa gửi link đăng nhập.'
              : 'Check your inbox — we just sent you a sign-in link.'}
          </p>

          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 mb-4">
            <Mail size={16} className="text-zinc-500 flex-shrink-0" />
            <span className="text-sm text-zinc-300 truncate">{email}</span>
          </div>

          {magicLink && (
            <details className="text-left mb-4">
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                {isVi ? 'Không nhận được email? Mở link trực tiếp' : "Didn't get the email? Open link directly"}
              </summary>
              <a
                href={magicLink}
                className="block mt-2 px-3 py-2 rounded-lg bg-violet-950/40 border border-violet-500/30 text-violet-300 text-xs break-all hover:bg-violet-900/40 transition-colors"
              >
                {magicLink}
              </a>
            </details>
          )}

          <p className="text-xs text-zinc-600">
            {isVi
              ? 'Link có hiệu lực trong 72 giờ. Nếu cần gửi lại, ghé /welcome/resend.'
              : 'The link is valid for 72 hours. To resend, visit /welcome/resend.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Map backend reason codes to friendly bilingual messages. */
function translateReason(reason: string | undefined, isVi: boolean): string | null {
  if (!reason) return null;
  const map: Record<string, { vi: string; en: string }> = {
    invalid_code: {
      vi: 'Mã không hợp lệ hoặc đã hết hạn.',
      en: 'Invalid or expired code.',
    },
    max_uses: {
      vi: 'Mã đã hết lượt sử dụng. Vui lòng liên hệ ban tổ chức.',
      en: 'This code has reached its max redemptions. Please contact support.',
    },
    expired: {
      vi: 'Mã đã hết hạn.',
      en: 'This code has expired.',
    },
    already_redeemed: {
      vi: 'Email này đã sử dụng mã trước đó.',
      en: 'This email has already redeemed this code.',
    },
    user_create_failed: {
      vi: 'Không tạo được tài khoản. Email có thể đã tồn tại — vui lòng đăng nhập.',
      en: 'Could not create account. Email may already exist — try signing in.',
    },
  };
  const entry = map[reason];
  if (!entry) return null;
  return isVi ? entry.vi : entry.en;
}
