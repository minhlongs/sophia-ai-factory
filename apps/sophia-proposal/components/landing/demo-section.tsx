"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type DemoCommand = "proposal:create" | "content:blog" | "lead:generate";

interface DemoTab {
  label: string;
  command: DemoCommand;
}

interface DemoApiResponse {
  result: string;
  command: string;
  duration_ms: number;
  tokens_used: number;
  error?: string;
}

// ── Static fallbacks (used when API fails) ────────────────────────────────────

const DEMO_FALLBACKS: Record<DemoCommand, string> = {
  "proposal:create": `> sophia proposal:create --topic "{topic}"

  Analyzing client profile...
  Generating executive summary...
  Building ROI projections...

  ✓ Proposal generated in 1.8s
  ✓ 12 pages • 3 pricing tiers • Custom branding
  ✓ PDF + interactive web link ready

--- Full version includes 12-page proposal with ROI analysis, timeline, pricing, and case studies. Sign up for full access.`,
  "content:blog": `> sophia content:blog --topic "{topic}"

  Researching keywords...
  Drafting outline...
  Writing 1,500-word article...

  ✓ Content ready in 2.1s
  ✓ SEO-optimized • Plagiarism-free
  ✓ Export to Notion, WordPress, or PDF

--- Full version includes 1,500+ word SEO-optimized post with meta tags, images, and social media snippets. Sign up for full access.`,
  "lead:generate": `> sophia lead:generate --industry "{topic}"

  Scanning 42M+ company database...
  Scoring by ICP fit...
  Enriching contact data...

  ✓ 87 leads found in 3.2s
  ✓ Email + LinkedIn + phone verified
  ✓ CRM-ready CSV exported

--- Full version generates 10-20 scored leads with contact details, pain points, and personalized outreach. Sign up for full access.`,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEMO_TABS: DemoTab[] = [
  { label: "Generate Proposal", command: "proposal:create" },
  { label: "Write Blog Post", command: "content:blog" },
  { label: "Find Leads", command: "lead:generate" },
];

const MAX_DEMOS = 3;
const TYPING_INTERVAL_MS = 8;

// ── Component ─────────────────────────────────────────────────────────────────

export function DemoSection() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [activeCommand, setActiveCommand] = useState<DemoCommand>("proposal:create");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<{ durationMs: number; tokensUsed: number } | null>(null);

  const animateOutput = (text: string) => {
    let i = 0;
    const interval = setInterval(() => {
      setOutput(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setLoading(false);
        setDemoCount((c) => c + 1);
      }
    }, TYPING_INTERVAL_MS);
  };

  const handleGenerate = async () => {
    if (!topic.trim() || loading || demoCount >= MAX_DEMOS) return;

    setLoading(true);
    setOutput("");
    setError("");
    setMetrics(null);

    try {
      const res = await fetch("/api/v1/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: activeCommand, topic: topic.trim() }),
      });

      const data = (await res.json()) as DemoApiResponse;

      if (!res.ok || data.error) {
        // Graceful fallback to static preview
        const fallback = DEMO_FALLBACKS[activeCommand].replace("{topic}", topic.trim());
        animateOutput(fallback);
        return;
      }

      setMetrics({ durationMs: data.duration_ms, tokensUsed: data.tokens_used });
      animateOutput(data.result);
    } catch {
      // Network error — use fallback
      const fallback = DEMO_FALLBACKS[activeCommand].replace("{topic}", topic.trim());
      animateOutput(fallback);
    }
  };

  const remaining = MAX_DEMOS - demoCount;
  const limitReached = demoCount >= MAX_DEMOS;

  return (
    <section className="py-28 bg-surface">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">play_circle</span>
            Live Demo
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            See Sophia{" "}
            <span className="text-primary">in Action</span>
          </h2>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Enter any topic and watch Sophia generate a real output in seconds.
          </p>
        </ScrollReveal>

        <ScrollReveal>
          <div className="max-w-3xl mx-auto">
            {/* Command tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {DEMO_TABS.map((tab) => (
                <button
                  key={tab.command}
                  onClick={() => setActiveCommand(tab.command)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    activeCommand === tab.command
                      ? "bg-primary text-white border-primary"
                      : "bg-surface-container text-on-surface-variant border-outline/30 hover:border-primary/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
                placeholder="e.g. SaaS proposal for a fintech client..."
                className="flex-1 px-5 py-3 rounded-full bg-surface-container border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 text-sm transition-colors"
                disabled={loading || limitReached}
              />
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={loading || !topic.trim() || limitReached}
                className="rounded-full px-6 shrink-0 cursor-pointer"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base mr-2">bolt</span>
                    Generate Preview
                  </>
                )}
              </Button>
            </div>

            {/* Rate limit indicator */}
            <p className="text-xs text-on-surface-variant/60 text-right mb-6">
              <span className="material-symbols-outlined text-xs align-middle mr-1">timer</span>
              {remaining > 0
                ? `${remaining} free demo${remaining !== 1 ? "s" : ""} remaining today`
                : "Daily limit reached — sign up for unlimited"}
            </p>

            {/* Output terminal */}
            <div className="relative rounded-2xl bg-[#0a0f1a] border border-white/8 overflow-hidden">
              {/* Terminal chrome */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/8 bg-white/[0.02]">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs text-white/30 font-mono">sophia-ai — terminal</span>
              </div>

              <div className="p-6 min-h-[160px] font-mono text-sm">
                {output ? (
                  <pre className="text-green-400/90 whitespace-pre-wrap leading-relaxed">{output}</pre>
                ) : (
                  <p className="text-white/20 text-sm">
                    {limitReached
                      ? "Daily demo limit reached. Sign up to continue."
                      : "Enter a topic above and click Generate Preview..."}
                  </p>
                )}
              </div>

              {/* Metrics bar */}
              {metrics && !loading && (
                <div className="px-5 py-2 border-t border-white/8 bg-white/[0.02] flex items-center gap-4 text-xs text-white/40 font-mono">
                  <span>Generated in {metrics.durationMs}ms</span>
                  <span>|</span>
                  <span>{metrics.tokensUsed} tokens</span>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <p className="mt-3 text-sm text-amber-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">warning</span>
                {error}
              </p>
            )}

            {/* CTA */}
            <div className="mt-8 text-center">
              <p className="text-on-surface-variant text-sm mb-4">
                {limitReached
                  ? "You've used all 3 free demos."
                  : "This is a preview. Full access unlocks all 17 AI commands with real execution."}
              </p>
              <Button
                variant="primary"
                size="lg"
                className="glow-primary cursor-pointer rounded-full px-10 text-base"
                onClick={() => router.push("/signup")}
              >
                <span className="material-symbols-outlined text-lg mr-2">rocket_launch</span>
                {limitReached
                  ? "Create free account for unlimited access →"
                  : "Get full access — Start free trial"}
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
