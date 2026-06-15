/**
 * Redeem layout — noindex to prevent crawlers from indexing promo redemption pages.
 */

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
