"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "top-3 left-4 right-4 bg-surface/80 backdrop-blur-xl border border-outline-variant/40 rounded-2xl shadow-md3-3"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto px-5 h-14 flex items-center justify-between max-w-7xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer group">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
            scrolled
              ? "bg-primary/10"
              : "bg-on-surface-dark/10"
          }`}>
            <span
              className="material-symbols-outlined text-lg transition-colors"
              style={{ color: scrolled ? "var(--md-sys-color-primary)" : "var(--md-sys-color-inverse-primary)" }}
              aria-hidden="true"
            >
              smart_toy
            </span>
          </div>
          <span className={`font-bold text-base tracking-tight transition-colors ${scrolled ? "text-on-surface" : "text-on-surface-dark"}`}>
            Sophia
          </span>
        </Link>

        {/* Desktop nav — pill-style links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`px-4 py-1.5 rounded-full transition-all text-sm font-medium cursor-pointer ${
                scrolled
                  ? "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  : "text-on-surface-dark-variant hover:text-on-surface-dark hover:bg-on-surface-dark/10"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <span className={`text-sm font-medium cursor-pointer transition-colors ${
              scrolled ? "text-on-surface-variant hover:text-on-surface" : "text-on-surface-dark-variant hover:text-on-surface-dark"
            }`}>
              Log in
            </span>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm" className="cursor-pointer rounded-full px-5">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`md:hidden p-2 rounded-xl transition-colors cursor-pointer ${scrolled ? "hover:bg-surface-container-high" : "hover:bg-on-surface-dark/10"}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className={`material-symbols-outlined ${scrolled ? "text-on-surface-variant" : "text-on-surface-dark"}`}>
            {menuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface/95 backdrop-blur-xl border-t border-outline/10 px-5 py-5 flex flex-col gap-3 rounded-b-2xl">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-on-surface-variant hover:text-on-surface transition-colors text-base font-medium cursor-pointer py-2"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="flex-1" onClick={() => setMenuOpen(false)}>
              <Button variant="outline" size="sm" className="w-full cursor-pointer rounded-full">
                Log in
              </Button>
            </Link>
            <Link href="/signup" className="flex-1" onClick={() => setMenuOpen(false)}>
              <Button variant="primary" size="sm" className="w-full cursor-pointer rounded-full">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
