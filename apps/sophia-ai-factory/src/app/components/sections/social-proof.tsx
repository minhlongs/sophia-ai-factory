"use client";

import { useTranslations, useLocale } from "next-intl";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { FadeInView } from "@/components/ui/fade-in-view";
import { useRef, useEffect, useState } from "react";
import { Star, Shield, Award } from "lucide-react";

/** Animated counter using native IntersectionObserver (replaces framer-motion useInView) */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let start = 0;
          const step = Math.ceil(target / 40);
          const timer = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(start);
            }
          }, 30);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

const TRUST_BADGES = [
  { icon: Shield, key: "secure" },
  { icon: Star, key: "rated" },
  { icon: Award, key: "certified" },
] as const;

export function SocialProof() {
  const t = useTranslations("landing.social_proof");
  const locale = useLocale();

  const testimonials = [
    { key: "creator_1", avatar: "MC" },
    { key: "creator_2", avatar: "TN" },
    { key: "creator_3", avatar: "SA" },
  ] as const;

  const stats = [
    { value: 1000, suffix: "+", labelKey: "stats.creators" },
    { value: 50, suffix: "+", labelKey: "stats.ai_tools" },
    { value: 10000, suffix: "+", labelKey: "stats.videos" },
  ] as const;

  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/3 w-[600px] h-[600px] bg-[var(--neon-cyan)] opacity-5 blur-[150px] rounded-full -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[var(--neon-purple)] opacity-5 blur-[120px] rounded-full -z-10" />

      <Container>
        <SectionHeading
          title={t("title")}
          subtitle={t("subtitle")}
        />

        {/* Stats Counter */}
        <FadeInView duration={500}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto mb-16">
            {stats.map((stat) => (
              <div key={stat.labelKey} className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {t(stat.labelKey)}
                </div>
              </div>
            ))}
          </div>
        </FadeInView>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {testimonials.map((item, index) => (
            <FadeInView
              key={item.key}
              delay={index * 150}
              duration={500}
            >
              <Card glass className="h-full">
                <CardContent className="pt-6">
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-muted-foreground mb-4 italic">
                    &ldquo;{t(`testimonials.${item.key}.quote`)}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] flex items-center justify-center text-white text-sm font-bold">
                      {item.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">
                        {t(`testimonials.${item.key}.name`)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t(`testimonials.${item.key}.role`)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeInView>
          ))}
        </div>

        {/* Trust Badges */}
        <FadeInView delay={300} direction="none">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {TRUST_BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <div key={badge.key} className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="w-5 h-5 text-[var(--neon-cyan)]" />
                  <span className="text-sm font-medium">{t(`badges.${badge.key}`)}</span>
                </div>
              );
            })}
          </div>
        </FadeInView>
      </Container>
    </section>
  );
}
