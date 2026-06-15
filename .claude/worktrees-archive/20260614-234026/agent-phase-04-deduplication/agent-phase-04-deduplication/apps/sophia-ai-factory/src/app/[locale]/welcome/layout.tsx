/**
 * Welcome layout — noindex to prevent crawlers from indexing token-based welcome pages.
 */

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
