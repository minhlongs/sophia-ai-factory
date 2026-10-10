"use client";

import React from "react";
import type { MarketplaceTemplate } from "./types";
import { Stars, formatSales } from "./star-rating";

interface MarketplaceCardProps {
  item: MarketplaceTemplate;
  t: (key: string) => string;
}

export function MarketplaceCard({ item, t }: MarketplaceCardProps) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-[#27272A] bg-[#18181B] transition-all duration-200 hover:border-[#D97706]/50 hover:shadow-[0_0_20px_rgba(217,119,6,0.08)]">
      {/* JSON-LD Product schema — enhanced for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: item.name,
            description: item.previewMd?.slice(0, 300) ?? item.name,
            image: item.authorLogoUrl ?? undefined,
            category: item.category,
            sku: item.templateId ?? item.id,
            mpn: item.templateId ?? item.id,
            brand: {
              "@type": "Organization",
              name: item.authorBrandName ?? `Sophia Creator ${item.authorUserId?.slice(0, 6) ?? "Unknown"}`,
              logo: item.authorLogoUrl ?? undefined,
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: (item.priceCents / 100).toFixed(2),
              availability: "https://schema.org/InStock",
              url: `${typeof window !== "undefined" ? window.location.origin : ""}/marketplace/${item.templateId ?? item.id}`,
              seller: {
                "@type": "Organization",
                name: item.authorBrandName ?? "Sophia Marketplace",
              },
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: item.ratingAvg.toFixed(1),
              reviewCount: item.ratingCount,
              bestRating: 5,
              worstRating: 1,
            },
          }),
        }}
      />

      {/* Thumbnail placeholder */}
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#27272A] to-[#18181B]">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-10 w-10 text-[#27272A] group-hover:text-[#D97706]/30 transition-colors duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        {/* Category badge */}
        <span className="absolute bottom-2 left-2 rounded-md border border-[#27272A] bg-[#18181B]/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#D97706] backdrop-blur-sm">
          {item.category}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        <h3 className="text-xs md:text-sm font-semibold leading-snug text-white line-clamp-2">
          {item.name}
        </h3>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#27272A]/60 px-2 py-0.5 text-[10px] text-[#71717A]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Author — show agency brand name if available */}
        {(item.authorBrandName || item.authorUserId) && (
          <p className="text-[10px] text-[#52525B] flex items-center gap-1">
            {item.authorLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic author logo URL
              <img src={item.authorLogoUrl} alt="" className="w-3.5 h-3.5 rounded object-contain inline-block" />
            ) : null}
            <span>
              {t("byLabel")} {item.authorBrandName ?? `#${item.authorUserId!.slice(0, 6)}`}
            </span>
          </p>
        )}

        {/* Rating + Sales row */}
        <div className="mt-auto flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[#A1A1AA]">
            <Stars avg={item.ratingAvg} />
            <span className="text-[#71717A]">
              {item.ratingAvg.toFixed(1)}
            </span>
          </span>
          <span className="text-[#71717A]">
            {formatSales(item.totalSales)} {t("sales")}
          </span>
        </div>
      </div>
    </div>
  );
}
