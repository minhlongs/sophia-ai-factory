/**
 * Settings layout — noindex to prevent crawlers from indexing user settings pages.
 */

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
