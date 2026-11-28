import React from 'react';
import {
  Clapperboard,
  Coins,
  FileText,
  KeyRound,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/navigation';
import { MarketingNav } from '@/components/stitch/layouts/marketing-nav';
import { MarketingFooter } from '@/components/stitch/layouts/marketing-footer';

export const dynamic = 'force-dynamic';

interface FeatureStageItem {
  readonly step: string;
  readonly count: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly viTitle: string;
  readonly enTitle: string;
  readonly viDesc: string;
  readonly enDesc: string;
}

const STAGES: readonly FeatureStageItem[] = [
  {
    step: '01',
    count: '8',
    icon: FileText,
    viTitle: 'Kịch bản & Luật Sàn',
    enTitle: 'Script & Policy Gate',
    viDesc: 'Chấm điểm Hook 3 giây, tự chèn #QuảngCáo chuẩn FTC / VN.',
    enDesc: 'Scores 3s hooks and injects FTC / regional disclosures automatically.',
  },
  {
    step: '02',
    count: '7',
    icon: Clapperboard,
    viTitle: 'Video 9:16 • $0 GPU',
    enTitle: '9:16 Video • $0 GPU',
    viDesc: 'Dựng WebCodecs ngay trên trình duyệt, phụ đề động & âm thanh -14 LUFS.',
    enDesc: 'Browser WebCodecs rendering, kinetic captions & -14 LUFS loudness.',
  },
  {
    step: '03',
    count: '8',
    icon: ShieldCheck,
    viTitle: 'Khiên Edge & SubID',
    enTitle: 'Edge Shield & SubID',
    viDesc: 'Lọc bot ASN trung tâm dữ liệu, đóng dấu HMAC-SHA256 chống giả mạo.',
    enDesc: 'Filters datacenter bots and stamps HMAC-SHA256 SubIDs on every click.',
  },
  {
    step: '04',
    count: '9',
    icon: Radar,
    viTitle: 'Phân phối & A/B EPC',
    enTitle: 'Distribution & Bandit',
    viDesc: 'Làm ấm kênh an toàn, chọn giờ vàng & tự dồn traffic vào Hook thắng.',
    enDesc: 'Safe channel warmup, peak windows & Thompson Bandit EPC routing.',
  },
  {
    step: '05',
    count: '7',
    icon: Coins,
    viTitle: 'Sổ cái BigInt 3 chiều',
    enTitle: '3-Way BigInt Ledger',
    viDesc: 'Đối soát click, postback & chia 70/20/10 chính xác từng xu nguyên.',
    enDesc: 'Reconciles clicks, postbacks & 70/20/10 splits to exact integer cents.',
  },
];

const GUARANTEES = [
  {
    icon: KeyRound,
    viTitle: '100% BYOK Giá Gốc',
    enTitle: '100% Wholesale BYOK',
    viDesc: '0đ phí chênh lệch token AI.',
    enDesc: '$0 platform AI markup.',
  },
  {
    icon: Send,
    viTitle: 'Điều khiển @Sophia_Bbot',
    enTitle: 'Telegram @Sophia_Bbot',
    viDesc: 'Gõ /campaign, /status, /results.',
    enDesc: 'Run /campaign, /status, /results.',
  },
  {
    icon: Sparkles,
    viTitle: '0% Cắt Phế Hoa Hồng',
    enTitle: '0% Commission Cut',
    viDesc: 'Sàn Affiliate trả thẳng về bạn.',
    enDesc: 'Networks pay your accounts directly.',
  },
] as const;

export default async function FeaturesRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MarketingNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:py-16 space-y-12">
        <header className="mx-auto max-w-2xl text-center space-y-4">
          <span className="font-code inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary-text">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {isVi ? '39 ĐỘNG CƠ AI • 5 CHẶNG KHÉP KÍN' : '39 AI ENGINES • 5 AUTOMATED STAGES'}
          </span>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-5xl">
            {isVi ? '1 Link Affiliate. 5 Chặng Tự Động.' : '1 Affiliate Link. 5 Automated Stages.'}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {isVi
              ? 'Mọi công cụ cần để làm video affiliate ngắn — gọn trong 1 buồng lái.'
              : 'Everything needed to ship compliant affiliate videos — in one cockpit.'}
          </p>
        </header>

        <section
          aria-label={isVi ? '5 chặng dây chuyền 39 động cơ' : '5-stage 39-engine pipeline'}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <article
                key={stage.step}
                className="md3-surface-card flex flex-col justify-between gap-3 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-primary-text">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="font-code md3-tabular-nums rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {stage.count} {isVi ? 'động cơ' : 'engines'}
                  </span>
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-foreground">
                    {stage.step}. {isVi ? stage.viTitle : stage.enTitle}
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {isVi ? stage.viDesc : stage.enDesc}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section
          aria-label={isVi ? 'Cam kết sở hữu' : 'Ownership guarantees'}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {GUARANTEES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.enTitle}
                className="md3-surface-tonal flex items-center gap-4 rounded-2xl border border-border p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground">
                    {isVi ? item.viTitle : item.enTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isVi ? item.viDesc : item.enDesc}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="md3-surface-card flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isVi ? 'Chạy chiến dịch đầu tiên trong 10 phút' : 'Ship your first campaign in 10 minutes'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isVi
                ? 'Tạo tài khoản và mở ngay Xưởng Chiến Dịch + 39 Động Cơ.'
                : 'Create your account and open the First-Value Studio immediately.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup?next=/dashboard/first-value"
              className="md3-pill-button inline-flex min-h-[44px] items-center bg-primary px-6 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              {isVi ? 'Bắt đầu ngay' : 'Launch Now'}
            </Link>
            <Link
              href="/pricing"
              className="md3-pill-button inline-flex min-h-[44px] items-center border border-border bg-background px-5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              {isVi ? 'Xem bảng giá' : 'View Pricing'}
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
