"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Trang chủ", icon: "home" },
  { href: "/products", label: "Sản phẩm", icon: "inventory_2" },
  { href: "/about", label: "Về chúng tôi", icon: "info" },
  { href: "/franchise", label: "Nhượng quyền", icon: "storefront" },
  { href: "/contact", label: "Liên hệ", icon: "mail" },
];

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NavigationDrawer({ open, onClose }: NavigationDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Focus trap: Focus first interactive element when drawer opens
  useEffect(() => {
    if (open) {
      const drawer = document.querySelector('[role="dialog"]') as HTMLElement;
      if (drawer) {
        const firstButton = drawer.querySelector('button') as HTMLButtonElement;
        firstButton?.focus();
      }
    }
  }, [open]);

  return (
    <>
      {/* Backdrop - MD3 Scrim */}
      <div
        className={cn(
          "fixed inset-0 bg-scrim/32 z-40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[80vw]",
          "bg-surface-container-low shadow-elevation-1",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <Logo variant="color" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-primary/8 active:bg-primary/12 transition-colors"
              aria-label="Close menu"
            >
              <span className="material-symbols-rounded text-2xl text-on-surface">
                close
              </span>
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-full",
                "text-on-surface hover:bg-primary/8 active:bg-primary/12",
                "transition-colors group"
              )}
            >
              <span className="material-symbols-rounded text-2xl group-hover:text-primary transition-colors">
                {link.icon}
              </span>
              <span className="font-medium">{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* CTA Button */}
        <div className="p-4 mt-auto border-t border-outline-variant">
          <Link href="/products" onClick={onClose}>
            <Button variant="filled" className="w-full">
              <span className="material-symbols-rounded text-xl">
                shopping_bag
              </span>
              Mua ngay
            </Button>
          </Link>
        </div>
      </aside>
    </>
  );
}
