import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Privacy Policy - Sophia AI Factory",
  description: "How Sophia AI Factory collects, uses, and protects your data.",
};

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <main id="main-content" className="min-h-screen bg-black pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: April 30, 2026</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect information you provide directly: email address, name, API keys (encrypted at rest),
            and payment transaction records. We do NOT sell your data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. How We Use Your Data</h2>
          <p className="text-muted-foreground">
            Your data is used solely to provide and improve the Service — generating AI videos, processing payments,
            and sending transactional emails. API keys are encrypted using AES-256-GCM.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Data Storage & Security</h2>
          <p className="text-muted-foreground">
            Data is stored on Cloudflare D1 (global edge database) and Cloudflare R2 (object storage).
            All data is encrypted in transit (TLS 1.3) and at rest. We implement CSP, HSTS, and CSRF protection.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Third-Party Services</h2>
          <p className="text-muted-foreground">
            We use third-party services to deliver the Service: HeyGen (video generation), ElevenLabs (text-to-speech),
            OpenRouter (AI script writing), NOWPayments (payment processing), and Resend (email delivery).
            Each service has its own privacy policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Your Rights</h2>
          <p className="text-muted-foreground">
            You may request deletion of your data at any time. Contact us to exercise your data rights.
            We will respond within 30 days.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Contact</h2>
          <p className="text-muted-foreground">
            Data protection inquiries: Telegram @Sophia_Bbot or email support.
          </p>
        </section>
      </div>
    </main>
  );
}
