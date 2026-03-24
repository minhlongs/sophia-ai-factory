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
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm" : "bg-transparent border-b border-transparent"}`}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span
            className="material-symbols-outlined text-2xl"
            style={{ color: scrolled ? "#0061a4" : "#5ec9ff" }}
            aria-hidden="true"
          >
            smart_toy
          </span>
          <span className={`font-semibold text-lg tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-white"}`}>
            Sophia AI Factory
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`transition-colors text-sm font-medium cursor-pointer ${scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/70 hover:text-white"}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Link href="/signup">
            <Button variant="primary" size="sm" className="cursor-pointer">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`md:hidden p-2 rounded-lg transition-colors cursor-pointer ${scrolled ? "hover:bg-gray-100" : "hover:bg-white/10"}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className={`material-symbols-outlined ${scrolled ? "text-gray-700" : "text-white"}`}>
            {menuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface border-t border-outline/20 px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-on-surface-variant hover:text-on-surface transition-colors text-base font-medium cursor-pointer"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link href="/signup" onClick={() => setMenuOpen(false)}>
            <Button variant="primary" size="sm" className="w-full cursor-pointer">
              Get Started
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
