import { Metadata } from "next";
import { YouTubeEmbed } from "@/components/guide/youtube-embed";

export const metadata: Metadata = {
  title: "Platform Integrations — Sophia AI Factory Guide",
  description: "Set up OpenRouter, HeyGen, ElevenLabs, and YouTube integrations for Sophia AI Factory",
};

const integrations = [
  {
    emoji: "\u{1F9E0}",
    name: "OpenRouter — AI Brain",
    what: "Powers Sophia's script writing and AI intelligence",
    pricing: "Free tier available, pay-per-use after",
    setupTime: "2 minutes",
    videoId: "VvJvJ0uXiVQ",
    videoTitle: "How to Use AI Models API for Free | OpenRouter Tutorial",
    steps: [
      "Go to openrouter.ai",
      'Click "Sign Up" (use your email)',
      'After login, click your name \u2192 "Keys"',
      'Click "Create Key" \u2192 name it "Sophia"',
      "Copy the key \u2192 paste in Sophia Settings \u2192 API Keys \u2192 OpenRouter",
    ],
  },
  {
    emoji: "\u{1F3AD}",
    name: "HeyGen — AI Avatar Creator",
    what: "Creates realistic AI avatars that present your videos",
    pricing: "Free trial, paid plans from $29/month",
    setupTime: "3 minutes",
    videoId: "wICY3ZV15QA",
    videoTitle: "HeyGen Academy: 101 - Introduction (Part 1)",
    steps: [
      "Go to heygen.com",
      'Click "Start Free Trial"',
      "After login, go to Settings \u2192 API",
      "Copy your API key",
      "Paste in Sophia Settings \u2192 API Keys \u2192 HeyGen",
    ],
  },
  {
    emoji: "\u{1F5E3}\uFE0F",
    name: "ElevenLabs — AI Voice",
    what: "Creates natural-sounding voiceovers for your videos",
    pricing: "Free tier (10,000 characters/month), paid from $5/month",
    setupTime: "2 minutes",
    videoId: "WBnywbB_4Lk",
    videoTitle: "How To Use Eleven Labs API",
    steps: [
      "Go to elevenlabs.io",
      'Click "Sign Up" (free)',
      'After login, click your profile \u2192 "Profile + API key"',
      "Copy the API key",
      "Paste in Sophia Settings \u2192 API Keys \u2192 ElevenLabs",
    ],
  },
  {
    emoji: "\u{1F4FA}",
    name: "YouTube Data API — Publishing Channel",
    what: "Allows Sophia to publish videos directly to your YouTube channel",
    pricing: "Free (Google quota limits apply)",
    setupTime: "5 minutes",
    videoId: null,
    videoTitle: null,
    steps: [
      "Go to console.cloud.google.com",
      'Create a new project (name it "Sophia")',
      'Enable "YouTube Data API v3"',
      "Go to Credentials \u2192 Create OAuth 2.0 Client ID",
      "Copy Client ID + Secret",
      "Paste in Sophia Settings \u2192 API Keys \u2192 YouTube",
    ],
  },
];

export default function IntegrationsGuidePage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
        Platform Integration Guides
      </h1>
      <p className="text-lg text-muted-foreground mt-2">
        Sophia connects to these services. Each guide below helps you set up in under 5 minutes.
      </p>

      <div className="space-y-12 mt-8">
        {integrations.map((integration) => (
          <section
            key={integration.name}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4"
          >
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 !mt-0">
              <span>{integration.emoji}</span> {integration.name}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">What</div>
                <div className="text-foreground">{integration.what}</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Pricing</div>
                <div className="text-foreground">{integration.pricing}</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Setup Time</div>
                <div className="text-foreground">{integration.setupTime}</div>
              </div>
            </div>

            {integration.videoId && integration.videoTitle && (
              <div>
                <h3 className="text-lg font-semibold text-foreground !mt-0 mb-2">Video Tutorial</h3>
                <YouTubeEmbed videoId={integration.videoId} title={integration.videoTitle} />
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-foreground !mt-0 mb-3">Step-by-Step Setup</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                {integration.steps.map((step, i) => (
                  <li key={i} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
