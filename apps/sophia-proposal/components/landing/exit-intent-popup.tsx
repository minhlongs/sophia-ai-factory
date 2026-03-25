"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmitState {
  loading: boolean;
  success: boolean;
  error: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sophia_exit_shown";
const MOBILE_TRIGGER_DELAY_MS = 60_000;
const EXCLUDED_PATHS = ["/signup", "/login"];

// ── Component ─────────────────────────────────────────────────────────────────

export function ExitIntentPopup() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({
    loading: false,
    success: false,
    error: "",
  });

  useEffect(() => {
    if (EXCLUDED_PATHS.includes(pathname)) return;
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile) {
      const timer = setTimeout(() => setVisible(true), MOBILE_TRIGGER_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // Desktop: trigger on mouse leaving viewport top
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setVisible(true);
        document.removeEventListener("mouseleave", handleMouseLeave);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [pathname]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitState({ loading: true, success: false, error: "" });

    try {
      const res = await fetch("/api/v1/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Exit Intent", email: email.trim(), company: "" }),
      });

      if (!res.ok) throw new Error("Request failed");

      setSubmitState({ loading: false, success: true, error: "" });
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      setSubmitState({ loading: false, success: false, error: "Something went wrong. Please try again." });
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-surface rounded-2xl border border-outline/20 p-8 shadow-2xl">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {submitState.success ? (
          <div className="text-center py-4">
            <span className="material-symbols-outlined text-4xl text-primary mb-3 block">mark_email_read</span>
            <h3 className="text-xl font-bold text-on-surface mb-2">Check your inbox!</h3>
            <p className="text-on-surface-variant text-sm">
              We sent your 200 free MCU credits to <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="material-symbols-outlined text-3xl text-primary mb-3 block">card_giftcard</span>
              <h3 className="text-2xl font-bold text-on-surface mb-2">
                Wait — get 200 free MCU credits
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Try all 17 AI commands. No credit card required.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-full bg-surface-container border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 text-sm transition-colors"
              />

              {submitState.error && (
                <p className="text-sm text-amber-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {submitState.error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitState.loading}
                className="rounded-full w-full cursor-pointer"
              >
                {submitState.loading ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  "Claim Credits"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
