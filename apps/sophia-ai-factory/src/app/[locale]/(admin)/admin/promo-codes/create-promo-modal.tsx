"use client";

/**
 * Modal form for creating a new promo code.
 */

import { useState } from "react";
import { X } from "lucide-react";
import type { PromoCodeRow, DiscountType } from "@/land/promo/promo-types";

interface CreatePromoModalProps {
  onClose: () => void;
  onCreated: (code: PromoCodeRow) => void;
}

const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string }[] = [
  { value: "percent_off", label: "% Off" },
  { value: "fixed_off", label: "Fixed $ Off" },
  { value: "free_trial", label: "Free Trial (days)" },
  { value: "free_full", label: "Full Free Access" },
];

const TIER_OPTIONS = ["", "BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];

function valueLabel(type: DiscountType): string {
  switch (type) {
    case "percent_off": return "Discount % (e.g. 50)";
    case "fixed_off": return "Discount cents (e.g. 5000 = $50)";
    case "free_trial": return "Trial days (e.g. 30)";
    case "free_full": return "N/A (leave 0)";
  }
}

export function CreatePromoModal({ onClose, onCreated }: CreatePromoModalProps) {
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "percent_off" as DiscountType,
    discountValue: 50,
    appliesToTier: "",
    appliesToSku: "",
    maxUses: "",
    maxUsesPerUser: 1,
    validUntilDays: 90,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const body: Record<string, unknown> = {
      code: form.code.toUpperCase(),
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: form.discountValue,
      appliesToTier: form.appliesToTier || undefined,
      appliesToSku: form.appliesToSku || undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      maxUsesPerUser: form.maxUsesPerUser,
      validUntil: form.validUntilDays
        ? Math.floor(Date.now() / 1000) + form.validUntilDays * 86400
        : undefined,
    };

    try {
      const res = await fetch("/api/admin/promo-codes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string; code?: PromoCodeRow };
      if (!res.ok || data.error) {
        setError(data.error ?? "Create failed");
        setSubmitting(false);
        return;
      }
      onCreated(data.code as PromoCodeRow);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Create Promo Code</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Code *</label>
              <input
                required
                type="text"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                placeholder="FREE50"
                maxLength={20}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono uppercase tracking-widest placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Discount Type *</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as DiscountType }))}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {DISCOUNT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">{valueLabel(form.discountType)}</label>
            <input
              type="number"
              min={0}
              value={form.discountValue}
              onChange={(e) => setForm((p) => ({ ...p, discountValue: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Launch promo 50% off"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Applies to Tier</label>
              <select
                value={form.appliesToTier}
                onChange={(e) => setForm((p) => ({ ...p, appliesToTier: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t || "All tiers"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Max Uses (blank = unlimited)</label>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
                placeholder="100"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Per-User Limit</label>
              <input
                type="number"
                min={1}
                value={form.maxUsesPerUser}
                onChange={(e) => setForm((p) => ({ ...p, maxUsesPerUser: parseInt(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Valid for (days)</label>
              <input
                type="number"
                min={1}
                value={form.validUntilDays}
                onChange={(e) => setForm((p) => ({ ...p, validUntilDays: parseInt(e.target.value) || 90 }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.code}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition"
            >
              {submitting ? "Creating..." : "Create Code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
