---
title: "Phase 3: Enhance SEO Metadata in Layout"
priority: P1
status: pending
---

# Phase 3: Enhance SEO Metadata in Layout

## Context
- Parent Plan: [[plan.md]](./plan.md)
- File: `app/layout.tsx`

## Overview
Add comprehensive SEO metadata including Open Graph, Twitter Card, and canonical URLs to the root layout.

## Requirements
- Open Graph tags for Facebook/LinkedIn sharing
- Twitter Card tags for Twitter sharing
- Canonical URL configuration
- Proper metadataBase for absolute URLs
- robots.txt configuration

## Implementation

### Modified File: `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = "https://sophia.agencyos.network";
const SITE_NAME = "Sophia Proposal";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Sophia AI Factory - Professional AI video production platform for businesses",
  keywords: [
    "AI video",
    "AI factory",
    "video production",
    "AI automation",
    "content creation",
  ],
  authors: [{ name: "Sophia AI Factory" }],
  creator: "Sophia AI Factory",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: SITE_NAME,
    description: "Professional AI video production platform",
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Sophia AI Factory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "Professional AI video production platform",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add verification codes when available
    // google: "google-site-verification-code",
  },
  other: {
    "link:stylesheet": "https://fonts.googleapis.com/icon?family=Material+Icons",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

## Todo
- [ ] Update `app/layout.tsx` with enhanced metadata
- [ ] Run `npm run build` and verify metadata is generated
- [ ] Verify no TypeScript errors

## Success Criteria
- Build completes successfully
- Generated HTML includes Open Graph meta tags
- Generated HTML includes Twitter Card meta tags
- Canonical link is present in rendered HTML

## Notes
- Replace `SITE_URL` with actual production URL
- Add `og-image.png` to `public/` folder for social sharing preview
- Twitter Card can be validated at https://cards-dev.twitter.com/validator
