"use client";

import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ChevronDown } from "lucide-react";

export function FAQ() {
  const t = useTranslations('landing');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqKeys = ['quality', 'copyright', 'time', 'skills', 'support', 'money', 'tiers', 'refund'] as const;
  const faqs = faqKeys.map(key => ({
    question: t(`faq.items.${key}.question`),
    answer: t(`faq.items.${key}.answer`),
  }));

  return (
    <section id="faq" className="py-20 md:py-32">
      <Container>
        <SectionHeading
          title={t('faq.title')}
          subtitle={t('faq.subtitle')}
        />

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <FadeInView
                key={index}
                delay={index * 50}
                duration={300}
              >
                <Card glass className="overflow-hidden bg-card border-border">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full text-left p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="font-semibold text-lg pr-8 text-foreground">{faq.question}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* CSS-only accordion using grid-template-rows trick */}
                  <div
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </Card>
              </FadeInView>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
