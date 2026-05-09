import { getTranslations } from "next-intl/server";

export const revalidate = 60;

export const metadata = {
  title: "Terms of Service - Sophia AI Factory",
  description: "Terms and conditions for using Sophia AI Factory — AI Video SaaS Platform.",
};

export default async function TermsPage() {
  const t = await getTranslations("terms");

  return (
    <main id="main-content" className="min-h-screen bg-black pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-muted-foreground text-sm">Last updated: April 30, 2026</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using Sophia AI Factory (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Subscription & Payments</h2>
          <p className="text-muted-foreground">
            The Service is offered on a subscription basis. Plans are billed monthly in USDT via NOWPayments.
            You are responsible for maintaining accurate payment information. Failed payments may result in service suspension.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Acceptable Use</h2>
          <p className="text-muted-foreground">
            You agree not to use the Service to create content that is illegal, harmful, or violates third-party rights.
            Sophia AI Factory reserves the right to suspend accounts that violate these terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Intellectual Property</h2>
          <p className="text-muted-foreground">
            Videos generated through the Service belong to you. The underlying AI models, platform code, and
            infrastructure remain the property of Sophia AI Factory.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            The Service is provided &quot;as is&quot; without warranties. Sophia AI Factory is not liable for
            damages arising from the use of the Service, including video generation failures or service interruptions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Contact</h2>
          <p className="text-muted-foreground">
            For questions about these terms, contact us via Telegram @Sophia_Bbot or email support.
          </p>
        </section>
      </div>
    </main>
  );
}
