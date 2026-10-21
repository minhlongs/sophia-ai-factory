// i18n-namespace: affiliateProgram
import Link from 'next/link';
import { JoinHero, CommissionTable, JoinForm, FaqSection } from './view';

/**
 * Public recruitment page for affiliate partners.
 *
 * Lives under the same public `[locale]/affiliate/*` tree as the marketing
 * landing, not under `affiliates/*`, because the middleware strips the locale
 * for that route family and serves it bare — which would break every
 * `getTranslations({ locale })` call and the page's hreflang.
 *
 * @module app/[locale]/affiliate/join/join-view
 */

export interface AffiliateJoinViewProps {
  signupHref: string;
  loginHref: string;
  termsHref: string;
  disclosureHref: string;
  /** Server-resolved: the form only offers self-serve creation to signed-in visitors. */
  isSignedIn: boolean;
  t: (key: string) => string;
}

export function AffiliateJoinView({
  signupHref,
  loginHref,
  termsHref,
  disclosureHref,
  isSignedIn,
  t,
}: AffiliateJoinViewProps) {
  return (
    <main className="mx-auto max-w-5xl space-y-14 px-6 py-16">
      <JoinHero signupHref={signupHref} loginHref={loginHref} t={t} />

      <CommissionTable t={t} />

      <section id="apply" className="mx-auto max-w-xl space-y-6 scroll-mt-24">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold md:text-3xl">{t('join.form.applyTitle')}</h2>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">{t('join.form.applyBody')}</p>
        </div>
        <JoinForm isSignedIn={isSignedIn} loginHref={loginHref} termsHref={termsHref} t={t} />
      </section>

      <FaqSection t={t} />

      <footer className="space-y-2 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        <p>{t('footer.disclaimer')}</p>
        <p className="space-x-3">
          <Link href={termsHref} className="underline hover:text-foreground">
            {t('footer.terms')}
          </Link>
          <Link href={disclosureHref} className="underline hover:text-foreground">
            {t('footer.disclosure')}
          </Link>
        </p>
      </footer>
    </main>
  );
}
