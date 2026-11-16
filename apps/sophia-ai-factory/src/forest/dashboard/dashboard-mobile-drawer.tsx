"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import type { DashboardUserProps } from "./dashboard-nav-modules";
import { DashboardUserCard } from "./dashboard-user-card";
import { DashboardNavItems } from "./dashboard-nav-items";

export interface DashboardMobileDrawerProps {
  rawPathname: string;
  isAdmin: boolean;
  isVi: boolean;
  userTier: string;
  user: DashboardUserProps;
  onCloseMobile?: () => void;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DashboardMobileDrawer({
  rawPathname,
  isAdmin,
  isVi,
  userTier,
  user,
  onCloseMobile,
  className,
}: DashboardMobileDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const mainEl = document.getElementById("main-content");
    const topBarEl = document.querySelector('[data-testid="dashboard-topbar"]');
    const prevMainHidden = mainEl?.getAttribute("aria-hidden") ?? null;
    const prevTopBarHidden = topBarEl?.getAttribute("aria-hidden") ?? null;
    const prevBodyOverflow = document.body.style.overflow;
    mainEl?.setAttribute("aria-hidden", "true");
    topBarEl?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";

    const desktopMedia =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 768px)")
        : null;
    const onMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        onCloseMobile?.();
      }
    };
    if (desktopMedia?.matches) {
      onCloseMobile?.();
    }
    desktopMedia?.addEventListener("change", onMediaChange);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseMobile?.();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !drawerRef.current.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !drawerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktopMedia?.removeEventListener("change", onMediaChange);
      document.body.style.overflow = prevBodyOverflow;
      if (mainEl) {
        if (prevMainHidden === null) mainEl.removeAttribute("aria-hidden");
        else mainEl.setAttribute("aria-hidden", prevMainHidden);
      }
      if (topBarEl) {
        if (prevTopBarHidden === null) topBarEl.removeAttribute("aria-hidden");
        else topBarEl.setAttribute("aria-hidden", prevTopBarHidden);
      }
      if (previousActive && previousActive.isConnected) {
        previousActive.focus();
      }
    };
  }, [onCloseMobile]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        onClick={onCloseMobile}
        data-testid="mobile-drawer-backdrop"
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-describedby="mobile-drawer-desc"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col h-full shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
          className
        )}
        data-testid="mobile-drawer"
        aria-label={isVi ? "Menu điều hướng di động" : "Mobile navigation drawer"}
      >
        <p id="mobile-drawer-desc" className="sr-only">
          {isVi
            ? "Trình đơn điều hướng di động của Sophia AI Factory"
            : "Sophia AI Factory mobile navigation menu"}
        </p>
        <div className="h-16 px-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center font-bold text-xs shadow-sm">
              S
            </div>
            <span className="text-sm font-bold text-foreground truncate">
              Sophia AI Factory
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCloseMobile}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label={isVi ? "Đóng menu điều hướng" : "Close navigation"}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <DashboardNavItems
          currentPath={rawPathname}
          isAdmin={isAdmin}
          isVi={isVi}
          userTier={userTier}
          onCloseMobile={onCloseMobile}
        />
        <DashboardUserCard user={user} isVi={isVi} onCloseMobile={onCloseMobile} />
      </aside>
    </>
  );
}
