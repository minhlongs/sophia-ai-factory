/**
 * Auth layout — noindex to prevent crawlers from indexing login/MFA pages.
 */

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
