// i18n-namespace: affiliateProgram

/**
 * FAQ for the public affiliate join page. Answers the questions that actually
 * decide whether a prospective partner applies, in the programme's real terms.
 *
 * @module app/[locale]/affiliate/join/view/faq-section
 */

/** Stable ids; the copy lives in the message files. */
const FAQ_IDS = ['rate', 'window', 'threshold', 'payout', 'selfReferral', 'refund'] as const;

export function FaqSection({ t }: { t: (key: string) => string }) {
  return (
    <section className="space-y-6">
      <h2 className="text-center text-2xl font-bold md:text-3xl">{t('join.faq.title')}</h2>
      <div className="mx-auto max-w-2xl divide-y divide-border rounded-xl border border-border bg-card">
        {FAQ_IDS.map((id) => (
          <details key={id} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground">
              {t(`join.faq.${id}.q`)}
              <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">
                ▾
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`join.faq.${id}.a`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
