"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useRouter } from "next/navigation";

const DEMO_PREVIEWS: Record<string, string> = {
  default: `> sophia proposal:create --client "Acme Corp" --budget 50000

  Analyzing client profile...
  Generating executive summary...
  Building ROI projections...

  ✓ Proposal generated in 1.8s
  ✓ 12 pages • 3 pricing tiers • Custom branding
  ✓ PDF + interactive web link ready`,
  marketing: `> sophia content:write --type blog --topic "{topic}"

  Researching keywords...
  Drafting outline...
  Writing 1,500-word article...

  ✓ Content ready in 2.1s
  ✓ SEO-optimized • Plagiarism-free
  ✓ Export to Notion, WordPress, or PDF`,
  sales: `> sophia lead:generate --industry SaaS --size 50-200

  Scanning 42M+ company database...
  Scoring by ICP fit...
  Enriching contact data...

  ✓ 87 leads found in 3.2s
  ✓ Email + LinkedIn + phone verified
  ✓ CRM-ready CSV exported`,
};

function getPreview(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes("content") || lower.includes("blog") || lower.includes("marketing")) {
    return DEMO_PREVIEWS.marketing.replace("{topic}", topic);
  }
  if (lower.includes("lead") || lower.includes("sales") || lower.includes("prospect")) {
    return DEMO_PREVIEWS.sales;
  }
  return DEMO_PREVIEWS.default;
}

export function DemoSection() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (demoCount >= 3) {
      setError("You've used all 3 free demos for today. Sign up for unlimited access.");
      return;
    }

    setLoading(true);
    setOutput("");
    setError("");

    // Simulate streaming output character by character
    const preview = getPreview(topic);
    let i = 0;
    const interval = setInterval(() => {
      setOutput(preview.slice(0, i + 1));
      i++;
      if (i >= preview.length) {
        clearInterval(interval);
        setLoading(false);
        setDemoCount((c) => c + 1);
      }
    }, 8);
  };

  const remaining = 3 - demoCount;

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
            {/* Input row */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
                placeholder="e.g. SaaS proposal for a fintech client..."
                className="flex-1 px-5 py-3 rounded-full bg-surface-container border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 text-sm transition-colors"
                disabled={loading || demoCount >= 3}
              />
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={loading || !topic.trim() || demoCount >= 3}
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
                    {demoCount >= 3
                      ? "Daily demo limit reached. Sign up to continue."
                      : "Enter a topic above and click Generate Preview..."}
                  </p>
                )}
              </div>
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
                This is a preview. Full access unlocks all 17 AI commands with real execution.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="glow-primary cursor-pointer rounded-full px-10 text-base"
                onClick={() => router.push("/signup")}
              >
                <span className="material-symbols-outlined text-lg mr-2">rocket_launch</span>
                Get full access — Start free trial
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
