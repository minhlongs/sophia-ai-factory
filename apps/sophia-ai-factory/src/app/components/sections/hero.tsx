"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { motion } from "framer-motion";
import Link from "next/link";

export function Hero() {
  const t = useTranslations('landing');
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        {/* Radial gradient glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--neon-cyan)] opacity-20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--neon-purple)] opacity-20 blur-[120px] rounded-full" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
      </div>

      <Container size="lg">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-[var(--neon-cyan)] via-white to-[var(--neon-purple)] bg-clip-text text-transparent">
                {t('hero.title_1')}
              </span>
              <br />
              <span className="text-white">
                {t('hero.title_2')}
              </span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link href="/dashboard">
              <Button variant="glow" size="lg" className="w-full sm:w-auto min-w-[200px]">
                {t('hero.cta_start')}
              </Button>
            </Link>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("features");
                if (el) {
                  const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
                  window.scrollTo({ top: y, behavior: "smooth" });
                }
              }}
            >
              <Button variant="secondary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                {t('hero.cta_demo')}
              </Button>
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                50+
              </div>
              <div className="text-sm text-gray-500 mt-2">{t('hero.stats.tools')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                10K+
              </div>
              <div className="text-sm text-gray-500 mt-2">{t('hero.stats.videos')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                24/7
              </div>
              <div className="text-sm text-gray-500 mt-2">{t('hero.stats.automation')}</div>
            </div>
          </motion.div>
        </div>
      </Container>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-primary/20 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-primary/40 rounded-full" />
        </div>
      </motion.div>
    </section>
  );
}
