"use client";

import { useState } from "react";
import { TopAppBar } from "./top-app-bar";
import { NavigationDrawer } from "./navigation-drawer";
import { BottomNavigation } from "./bottom-navigation";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Skip to Content Link - Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-full focus:shadow-elevation-2"
      >
        Bỏ qua đến nội dung chính
      </a>

      {/* Top App Bar */}
      <TopAppBar onMenuClick={() => setDrawerOpen(true)} />

      {/* Navigation Drawer (Mobile) */}
      <NavigationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Main Content */}
      <main id="main-content" className="min-h-screen pt-16 pb-24 md:pb-0">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <BottomNavigation />
    </>
  );
}
