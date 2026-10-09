import React from 'react';
import { Sparkles, Send, Copy, Check } from 'lucide-react';

interface ReferralLinksTabProps {
  isVi: boolean;
  subId: string;
  setSubId: (val: string) => void;
  primaryShareLink: string;
  telegramBotLink: string;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
}

export function ReferralLinksTab({
  isVi,
  subId,
  setSubId,
  primaryShareLink,
  telegramBotLink,
  copiedKey,
  copyToClipboard,
}: ReferralLinksTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-400" />
          {isVi ? 'Link Tiếp Thị Chính Thức' : 'Personalized Affiliate Share Link'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isVi
            ? 'Mỗi lượt nhấp sẽ lưu cookie 60 ngày. Mọi đơn đăng ký Starter ($199), Growth ($399), Premium ($799) sẽ tự động cộng 20%–30% MRR cho bạn.'
            : 'Each visitor click is tracked via a 60-day attribution cookie. Every recurring subscription ($199 Starter, $399 Growth, $799 Premium) credits you 20%–30% MRR.'}
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            {isVi ? 'Thêm Chiến Dịch Sub-ID (Tùy chọn):' : 'Custom Sub-ID Parameter (Optional):'}
          </label>
          <input
            type="text"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            placeholder="e.g. tiktok_short_01, youtube_bio, x_thread"
            className="w-full text-xs font-mono bg-muted/60 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-muted/40 border border-border p-3 rounded-xl">
          <code className="text-xs font-mono text-cyan-300 break-all flex-1">
            {primaryShareLink}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(primaryShareLink, 'web-link')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition"
          >
            {copiedKey === 'web-link' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            {copiedKey === 'web-link' ? (isVi ? 'Đã chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Send className="w-5 h-5 text-cyan-400" />
          {isVi ? 'Deep Link Bot Telegram Bán Hàng' : 'Telegram Sales Bot Deep Link'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isVi
            ? 'Gửi khách hàng trực tiếp vào bot @Sophia_Bbot. Bot sẽ tự động chào, khảo sát nhu cầu, gửi video demo và chốt đơn với mã SOLO100 kèm ghi nhận hoa hồng cho bạn.'
            : 'Send traffic directly to our automated @Sophia_Bbot. The bot qualifies leads, sends instant demo videos, and triggers checkout with promo code SOLO100 while attributing to your partner ID.'}
        </p>

        <div className="flex items-center gap-2 bg-muted/40 border border-border p-3 rounded-xl mt-4">
          <code className="text-xs font-mono text-cyan-300 break-all flex-1">
            {telegramBotLink}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(telegramBotLink, 'tg-link')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition"
          >
            {copiedKey === 'tg-link' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            {copiedKey === 'tg-link' ? (isVi ? 'Đã chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
          </button>
        </div>

        <div className="text-xs text-muted-foreground bg-primary-500/10 border border-primary-500/20 p-3 rounded-xl">
          💡 <strong>{isVi ? 'Mẹo Tăng Chuyển Đổi' : 'High Conversion Tip'}:</strong>{' '}
          {isVi
            ? 'Đặt link Telegram này vào bio TikTok hoặc YouTube Shorts của bạn để tăng tỷ lệ chốt đơn lên đến 35%.'
            : 'Place this Telegram link in your TikTok/Shorts bio for up to 35% higher checkout completion.'}
        </div>
      </div>
    </div>
  );
}
