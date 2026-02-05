"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CartButton } from "@/components/cart";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/products", label: "Sản phẩm" },
  { href: "/about", label: "Về chúng tôi" },
  { href: "/franchise", label: "Nhượng quyền" },
  { href: "/contact", label: "Liên hệ" },
];

interface TopAppBarProps {
  onMenuClick: () => void;
}

export function TopAppBar({ onMenuClick }: TopAppBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Update scrolled state (for background change)
      setScrolled(currentScrollY > 20);
      
      // MD3 scroll behavior: hide on down, show on up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down
        setVisible(false);
      } else {
        // Scrolling up
        setVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        // MD3 scroll behavior
        visible ? "translate-y-0" : "-translate-y-full",
        // Background transition
        scrolled
          ? "bg-surface shadow-elevation-2 border-b border-outline-variant"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Leading: Menu icon (mobile) */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-primary/8 active:bg-primary/12 transition-colors"
            aria-label="Open menu"
          >
            <span className="material-symbols-rounded text-2xl text-on-surface">
              menu
            </span>
          </button>

          {/* Center: Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="color" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  "text-on-surface hover:text-primary",
                  "relative after:absolute after:bottom-0 after:left-0 after:right-0",
                  "after:h-0.5 after:bg-primary after:scale-x-0 after:transition-transform",
                  "hover:after:scale-x-100"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Trailing: Actions */}
          <div className="flex items-center gap-2">
            <Link href="/products" className="hidden md:block">
              <Button variant="filled" size="default">
                Mua ngay
              </Button>
            </Link>
            <ThemeToggle />
            <CartButton />
          </div>
        </div>
      </div>
    </header>
  );
}
