"use client";

import { useState } from "react";
import { Container } from "@/app/components/ui/container";
import { SectionHeading } from "@/app/components/ui/section-heading";
import { FilterSidebar } from "@/app/components/affiliate/filter-sidebar";
import { ProgramGrid } from "@/app/components/affiliate/program-grid";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { getAllPrograms } from "@/lib/affiliates";
import { getCurrentTier } from "@/lib/auth";
import { hasTierAccess } from "@/lib/features";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AffiliateDiscoveryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ min: number; max: number } | null>(null);

  const userTier = getCurrentTier();
  const hasAccess = hasTierAccess(userTier, "enable_affiliate_engine");

  // Get all programs for filter options
  const allPrograms = getAllPrograms();

  // For Basic tier, show limited preview
  let displayPrograms = hasAccess
    ? allPrograms
    : allPrograms.filter(p => p.tier === "BASIC").slice(0, 3);

  // Apply category filter
  if (selectedCategory && hasAccess) {
    displayPrograms = displayPrograms.filter(p => p.category === selectedCategory);
  }

  // Apply commission range filter
  if (selectedRange && hasAccess) {
    displayPrograms = displayPrograms.filter(p => {
      const commission = parseFloat(p.commission);
      return commission >= selectedRange.min && commission <= selectedRange.max;
    });
  }

  // Extract unique categories for filter
  const categories = Array.from(new Set(allPrograms.map(p => p.category))).sort();

  // Commission ranges
  const commissionRanges = [
    { label: "10-30%", min: 10, max: 30 },
    { label: "30-50%", min: 30, max: 50 },
    { label: "50%+", min: 50, max: 200 },
  ];

  return (
    <main className="min-h-screen py-20">
      <Container>
        <SectionHeading
          title="Affiliate Discovery Engine"
          subtitle='Curated "Dự án Sạch" programs with high EPC and proven conversions'
        />

        {/* Upgrade Banner for Basic Tier */}
        {!hasAccess && (
          <Card glass className="mb-12 p-8 border-2 border-[var(--neon-cyan)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--neon-cyan)]/10 to-[var(--neon-purple)]/10" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--neon-cyan)]/20 rounded-lg">
                  <Lock className="w-6 h-6 text-[var(--neon-cyan)]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Unlock 20+ Premium Affiliate Programs
                  </h3>
                  <p className="text-gray-300 max-w-2xl">
                    Upgrade to Premium or Enterprise to access our full curated database of
                    high-converting affiliate programs with EPCs up to $5.20 and commissions up to 200%.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
                    <Sparkles className="w-4 h-4 text-[var(--neon-purple)]" />
                    <span>Including SmartSuite (50%), Glide (50%), Shopify (200%)</span>
                  </div>
                </div>
              </div>
              <Link href="/#pricing">
                <Button variant="glow" className="whitespace-nowrap">
                  View Pricing
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Filters - Only show if user has access */}
          {hasAccess && (
            <aside>
              <FilterSidebar
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                commissionRanges={commissionRanges}
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
              />
            </aside>
          )}

          {/* Programs Grid */}
          <div className={hasAccess ? "" : "lg:col-span-2"}>
            <ProgramGrid programs={displayPrograms} showAll={hasAccess} />

            {/* Bottom CTA for Basic Tier */}
            {!hasAccess && (
              <div className="mt-12 text-center">
                <Card glass className="p-8 inline-block">
                  <p className="text-gray-300 mb-4">
                    Want to see all {allPrograms.length} programs with advanced filtering?
                  </p>
                  <Link href="/#pricing">
                    <Button variant="glow">
                      Upgrade to Premium
                    </Button>
                  </Link>
                </Card>
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
