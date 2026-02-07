"use client";

import { Container } from "@/components/ui/container";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Select Niche",
    description: "Choose your target audience and content vertical",
    icon: "🎯",
  },
  {
    number: "02",
    title: "AI Generate",
    description: "Let AI create scripts, videos, and voice-overs",
    icon: "🤖",
  },
  {
    number: "03",
    title: "Publish",
    description: "Auto-distribute to multiple YouTube channels",
    icon: "🚀",
  },
  {
    number: "04",
    title: "Profit",
    description: "Earn from ads and affiliate commissions",
    icon: "💰",
  },
];

export function Workflow() {
  return (
    <section className="py-20 md:py-32">
      <Container>
        <SectionHeading
          title="Your Automated Content Factory"
          subtitle="From idea to income in 4 simple steps"
        />

        <div className="grid md:grid-cols-4 gap-8 relative">
          {/* Connecting lines (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] opacity-20" />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <Card glass hover className="relative z-10 h-full">
                <CardHeader className="text-center">
                  {/* Step Icon */}
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] flex items-center justify-center text-3xl">
                    {step.icon}
                  </div>

                  {/* Step Number */}
                  <div className="text-sm text-[var(--neon-cyan)] font-mono mb-2">
                    {step.number}
                  </div>

                  {/* Step Title */}
                  <CardTitle className="text-xl mb-2">{step.title}</CardTitle>

                  {/* Step Description */}
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>

              {/* Arrow indicator (desktop only, except last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 z-20">
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="w-6 h-6 text-[var(--neon-cyan)]" />
                  </motion.div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-gray-400 mb-4">
            Join 1,000+ creators building their content empires
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
