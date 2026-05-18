"use client";

/**
 * Input form for bulk promo code generation.
 * Handles count, description, expiry fields + submit button.
 */

import { useTranslations } from "next-intl";
import { Loader2, AlertCircle } from "lucide-react";

const MIN_COUNT = 1;
const MAX_COUNT = 1000;

interface BulkRequestFormProps {
  count: number;
  description: string;
  expiresAt: string;
  loading: boolean;
  error: string | null;
  onCountChange: (v: number) => void;
  onDescriptionChange: (v: string) => void;
  onExpiresAtChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function BulkRequestForm({
  count,
  description,
  expiresAt,
  loading,
  error,
  onCountChange,
  onDescriptionChange,
  onExpiresAtChange,
  onSubmit,
}: BulkRequestFormProps) {
  const t = useTranslations("admin.promoCodes.bulk");

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-6"
    >
      <div>
        <label htmlFor="count" className="block text-sm font-medium text-zinc-300 mb-1">
          {t("countLabel")} <span className="text-rose-400">*</span>
        </label>
        <input
          id="count"
          name="count"
          type="number"
          min={MIN_COUNT}
          max={MAX_COUNT}
          required
          value={count}
          onChange={(e) => onCountChange(Number(e.target.value))}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <p className="text-xs text-zinc-500 mt-1">{t("countHelper")}</p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-1">
          {t("descriptionLabel")}
        </label>
        <input
          id="description"
          name="description"
          type="text"
          maxLength={200}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      <div>
        <label htmlFor="expiresAt" className="block text-sm font-medium text-zinc-300 mb-1">
          {t("expiresLabel")}
        </label>
        <input
          id="expiresAt"
          name="expiresAt"
          type="date"
          value={expiresAt}
          onChange={(e) => onExpiresAtChange(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-sm text-rose-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">{t("errorTitle")}</div>
            <div className="opacity-80">{error}</div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || count < MIN_COUNT || count > MAX_COUNT}
        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-medium rounded-md transition"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

export { MIN_COUNT, MAX_COUNT };
