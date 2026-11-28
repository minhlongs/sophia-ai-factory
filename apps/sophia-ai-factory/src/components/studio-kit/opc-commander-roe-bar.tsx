'use client';

/**
 * Commander's Intent & Rules of Engagement (ROE) Bar — OODA DECIDE Zone.
 *
 * Lets a solo OPC Commander set target script/offer, platform, regional
 * compliance jurisdiction (VN / US-FTC / EU-MiCA / UK-FCA / SG), and revenue
 * mode (Auto Live D1 vs custom simulation USD) before deploying all 39 engines.
 *
 * @module components/studio-kit/opc-commander-roe-bar
 */

export type RoePlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels';
export type RoeRegion = 'VN' | 'US' | 'EU' | 'UK' | 'SG';

export interface CommanderRoeConfig {
  readonly script: string;
  readonly platform: RoePlatform;
  readonly region: RoeRegion;
  readonly useLiveD1Gross: boolean;
  readonly customGrossUsd: number;
}

export interface OpcCommanderRoeBarProps {
  readonly locale: 'vi' | 'en';
  readonly value: CommanderRoeConfig;
  readonly disabled: boolean;
  readonly onChange: (next: CommanderRoeConfig) => void;
}

const PLATFORMS: readonly { id: RoePlatform; label: string }[] = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube_shorts', label: 'YT Shorts' },
  { id: 'instagram_reels', label: 'Reels' },
  { id: 'facebook_reels', label: 'FB Reels' },
];

const REGIONS: readonly { id: RoeRegion; label: string }[] = [
  { id: 'VN', label: 'VN' },
  { id: 'US', label: 'US-FTC' },
  { id: 'EU', label: 'EU-MiCA' },
  { id: 'UK', label: 'UK-FCA' },
  { id: 'SG', label: 'SG' },
];

export function regionToJurisdiction(region: RoeRegion): 'VN' | 'US' | 'EU' | 'UK' | 'GLOBAL' {
  if (region === 'SG') return 'GLOBAL';
  return region;
}

export function regionToCountry(region: RoeRegion): 'VN' | 'US' | 'UK' | 'SG' | undefined {
  if (region === 'EU') return undefined;
  return region;
}

export function OpcCommanderRoeBar({
  locale,
  value,
  disabled,
  onChange,
}: OpcCommanderRoeBarProps) {
  return (
    <div
      data-testid="opc-commander-roe-bar"
      className="md3-surface-tonal space-y-2.5 rounded-2xl border border-border p-3"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="sr-only" htmlFor="opc-commander-script-input">
          {locale === 'vi' ? 'Mục tiêu chiến dịch / Kịch bản' : 'Campaign target / Script'}
        </label>
        <input
          id="opc-commander-script-input"
          type="text"
          disabled={disabled}
          value={value.script}
          onChange={(e) => onChange({ ...value, script: e.target.value })}
          placeholder={
            locale === 'vi'
              ? 'Nhập mục tiêu Offer hoặc kịch bản chiến dịch…'
              : 'Enter target offer or campaign script…'
          }
          className="min-h-[44px] flex-1 rounded-full border border-border bg-background px-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {PLATFORMS.map((p) => {
            const active = value.platform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange({ ...value, platform: p.id })}
                className={`min-h-[44px] rounded-full border px-3 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-[var(--md-sys-color-primary-container)] text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-code text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {locale === 'vi' ? 'Luật / Thị trường:' : 'ROE / Region:'}
          </span>
          {REGIONS.map((r) => {
            const active = value.region === r.id;
            return (
              <button
                key={r.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange({ ...value, region: r.id })}
                className={`font-code min-h-[36px] rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="toggle-live-d1-mode-btn"
            disabled={disabled}
            aria-pressed={value.useLiveD1Gross}
            onClick={() => onChange({ ...value, useLiveD1Gross: !value.useLiveD1Gross })}
            className={`font-code min-h-[36px] rounded-full border px-3 text-[11px] font-semibold transition-colors ${
              value.useLiveD1Gross
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            {value.useLiveD1Gross
              ? locale === 'vi'
                ? 'Doanh thu: Auto Live D1'
                : 'Gross: Auto Live D1'
              : locale === 'vi'
                ? `Mô phỏng: $${value.customGrossUsd}`
                : `Sim: $${value.customGrossUsd}`}
          </button>
        </div>
      </div>
    </div>
  );
}
