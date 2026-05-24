"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FadeInView } from "@/seed/components/ui/fade-in-view";
import { getAllPrograms } from "@/land/affiliates";
import { Tier } from "@/seed/types";
import { TIER_CONFIGS } from "@/seed/config/tiers";
import { Lock, ExternalLink, Star, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/seed/components/ui/badge";
import { Button } from "@/seed/components/ui/button";

/** Earnings rows: plan name key, monthly price, max commission (at ENTERPRISE 1.3x) */
const EARNINGS_ROWS = [
  { tierKey: "earnings_starter", price: "$199", commission: "$139" },
  { tierKey: "earnings_growth",  price: "$399", commission: "$279" },
  { tierKey: "earnings_premium", price: "$799", commission: "$559" },
] as const;

export function AffiliateDiscovery() {
  const t = useTranslations('landing');
  const tAff = useTranslations('affiliate');
  const [currentTier, setCurrentTier] = useState<Tier>("BASIC");
  const [filter, setFilter] = useState("All");

  const allPrograms = getAllPrograms();
  const categories = ["All", ...Array.from(new Set(allPrograms.map(p => p.category)))];

  const filteredPrograms = allPrograms.filter(p => filter === "All" || p.category === filter);

  const tierLevels: Record<Tier, number> = { BASIC: 0, PREMIUM: 1, ENTERPRISE: 2, MASTER: 3 };

  const isLocked = (programTier?: Tier) => {
    if (!programTier) return false;
    return tierLevels[currentTier] < tierLevels[programTier];
  };

  return (
    <section className="py-12 md:py-24 bg-secondary/50" id="affiliate-discovery">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          {/* 70% commission badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold mb-4">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            {tAff('commission_badge')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            {t('affiliate.title')}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t('affiliate.subtitle')}
          </p>

          {/* Earnings table */}
          <div className="mt-8 inline-block w-full max-w-md mx-auto">
            <p className="text-sm font-semibold text-foreground mb-3">{tAff('earnings_table_title')}</p>
            <div className="rounded-xl border border-border bg-card overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left">{tAff('earnings_tier_col')}</th>
                    <th scope="col" className="px-4 py-2 text-right">{tAff('earnings_price_col')}</th>
                    <th scope="col" className="px-4 py-2 text-right text-emerald-400">{tAff('earnings_commission_col')}</th>
                  </tr>
                </thead>
                <tbody>
                  {EARNINGS_ROWS.map(({ tierKey, price, commission }) => (
                    <tr key={tierKey} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium text-foreground text-left">
                        {tAff(tierKey as Parameters<typeof tAff>[0])}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-right">{price}/mo</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-400 text-right">{commission}/mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-muted/30 text-[11px] text-muted-foreground text-left">
                {tAff('tier_multiplier_note')}
              </div>
            </div>
            <Link
              href="/affiliate"
              className="mt-3 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity"
            >
              {tAff('copy_link_cta')}
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {/* Tier Selector for Demo */}
          <div className="mt-8 p-4 bg-card rounded-xl shadow-sm inline-block border border-border">
            <p className="text-sm text-muted-foreground mb-2 font-medium">{t('affiliate.preview_tier')}</p>
            <div className="flex gap-2 justify-center">
              {(["BASIC", "PREMIUM", "ENTERPRISE"] as Tier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setCurrentTier(tier)}
                  aria-pressed={currentTier === tier}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    currentTier === tier
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {TIER_CONFIGS[tier].name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 justify-center flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              aria-pressed={filter === category}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => {
            const locked = isLocked(program.tier);

            return (
              <FadeInView
                key={program.id}
                duration={500}
                className={`relative group bg-card rounded-2xl border ${
                  locked ? "border-border" : "border-border hover:border-blue-500/50 hover:shadow-lg"
                } transition-all overflow-hidden flex flex-col h-full`}
              >
                {/* Header */}
                <div className="p-6 pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-foreground mb-1">
                        {program.name}
                      </h3>
                      <div className="flex gap-2">
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {program.category}
                        </Badge>
                        {program.tier && program.tier !== "BASIC" && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> {TIER_CONFIGS[program.tier || 'BASIC'].name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">{t('affiliate.commission')}</p>
                      <p className="font-bold text-foreground">{locked ? "???" : program.commission}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">{t('affiliate.epc')}</p>
                      <p className="font-bold text-foreground">{locked ? "???" : `$${program.epc}`}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 pt-0 flex-grow">
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {program.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {program.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer / Action */}
                <div className="p-6 pt-0 mt-auto">
                  {locked ? (
                    <Button disabled className="w-full flex items-center justify-center gap-2 bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted">
                      <Lock className="w-4 h-4" />
                      {t('affiliate.unlock', { tier: TIER_CONFIGS[program.tier || 'BASIC'].name })}
                    </Button>
                  ) : (
                    <a href={program.link} target="_blank" rel="noopener noreferrer" className="block w-full">
                      <Button className="w-full flex items-center justify-center gap-2">
                        {t('affiliate.apply')}
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>

                {/* Lock Overlay */}
                {locked && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="bg-card p-6 rounded-xl shadow-xl border border-border text-center max-w-[80%]">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h4 className="font-bold text-foreground mb-2">
                        {t('affiliate.upgrade.title', { tier: TIER_CONFIGS[program.tier || 'BASIC'].name })}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('affiliate.upgrade.description')}
                      </p>
                      <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                        {t('affiliate.upgrade.button')}
                      </Button>
                    </div>
                  </div>
                )}
              </FadeInView>
            );
          })}
        </div>
      </div>
    </section>
  );
}
