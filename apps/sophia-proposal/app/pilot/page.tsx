import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { PilotApplicationForm } from "./pilot-application-form";

export const metadata: Metadata = {
  title: "Early Adopter Program — Sophia AI Factory",
  description:
    "Join 10 agencies testing AI-powered proposal automation. 50% off for 6 months. All 17 AI commands included.",
  openGraph: {
    title: "Sophia AI — Early Adopter Program",
    description: "50% off Growth plan for 6 months. Shape the future of AI proposals.",
    type: "website",
  },
};

const BENEFITS = [
  {
    icon: "savings",
    title: "Growth Plan at 50% Off",
    description: "$149/mo → $75/mo for 6 months",
  },
  {
    icon: "bolt",
    title: "2,000 MCU Credits/Month",
    description: "Enough for 80 proposals or 100 content pieces monthly",
  },
  {
    icon: "auto_awesome",
    title: "All 17 AI Commands",
    description: "Proposals, leads, emails, battlecards, content — full access",
  },
  {
    icon: "support_agent",
    title: "1:1 Onboarding Call",
    description: "60-min session to set up your first automated workflow",
  },
  {
    icon: "forum",
    title: "Direct Slack with Founder",
    description: "Real-time support — not a ticket queue",
  },
  {
    icon: "map",
    title: "Shape the Roadmap",
    description: "Your feedback directly influences what we build next",
  },
];

const REQUIREMENTS = [
  "Use Sophia weekly for real client work (not just testing)",
  "Join a 15-minute feedback call monthly",
  "Permission to use anonymized results as a case study",
];

const FAQ = [
  {
    q: "When does the pilot start?",
    a: "Rolling enrollment — you can start immediately after approval.",
  },
  {
    q: "How long is the pilot?",
    a: "6 months at the discounted rate. After that, standard pricing applies.",
  },
  {
    q: "What happens if I don't like it?",
    a: "Cancel anytime. No lock-in. We'll export all your data.",
  },
  {
    q: "Do I need technical skills?",
    a: "No. Sophia works via dashboard UI or API — your choice.",
  },
];

export default function PilotPage() {
  return (
    <main className="min-h-screen bg-surface">
      {/* Nav */}
      <nav className="bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
            </div>
            <span className="font-bold text-on-surface">Sophia AI Factory</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-on-surface-variant hover:text-on-surface">Home</Link>
            <Link href="/pricing" className="text-sm text-on-surface-variant hover:text-on-surface">Pricing</Link>
            <Link href="/login" className="text-sm px-4 py-1.5 bg-primary text-white rounded-full hover:opacity-90 font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4 text-center bg-gradient-to-br from-surface to-surface-container">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Limited Availability — 10 Spots
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface mb-5 tracking-tight">
            Early Adopter Program
          </h1>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            50% off for 6 months. Shape the future of AI-powered proposals.
          </p>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-on-surface text-center mb-10">What You Get</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((benefit, i) => (
              <ScrollReveal key={benefit.title} delay={i * 80}>
                <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant h-full">
                  <span className="material-symbols-outlined text-primary text-3xl mb-3 block">
                    {benefit.icon}
                  </span>
                  <h3 className="font-semibold text-on-surface mb-1">{benefit.title}</h3>
                  <p className="text-sm text-on-surface-variant">{benefit.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* What We Need */}
      <section className="py-16 px-4 bg-surface-container-high">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-on-surface text-center mb-8">What We Need From You</h2>
            <ul className="space-y-4">
              {REQUIREMENTS.map((req) => (
                <li key={req} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">check_circle</span>
                  <span className="text-on-surface-variant">{req}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 px-4">
        <div className="max-w-lg mx-auto">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-on-surface text-center mb-3">Apply Now</h2>
            <p className="text-on-surface-variant text-center mb-8">
              Takes 2 minutes. We review every application within 24 hours.
            </p>
            <PilotApplicationForm />
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-surface-container">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-on-surface text-center mb-10">FAQ</h2>
            <div className="space-y-6">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="border-b border-outline-variant pb-6 last:border-0">
                  <h3 className="font-semibold text-on-surface mb-2">{q}</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-12 px-4 bg-primary text-center">
        <p className="text-white font-semibold text-lg mb-1">Only 10 spots. First-come, first-served.</p>
        <p className="text-white/80 text-sm">Applications reviewed daily. No commitment required.</p>
      </section>
    </main>
  );
}
