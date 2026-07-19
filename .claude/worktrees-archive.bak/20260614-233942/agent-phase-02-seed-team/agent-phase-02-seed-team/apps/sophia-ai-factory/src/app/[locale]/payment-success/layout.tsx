/**
 * Payment-success layout — noindex to prevent crawlers from indexing post-payment confirmation pages.
 */

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PaymentSuccessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
