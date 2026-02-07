"use client";

import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "Is the AI-generated content high quality?",
    answer:
      "Yes! We use state-of-the-art AI models (RunwayML Gen-3, Pika 1.5, ElevenLabs) to create professional-grade videos. You maintain full creative control with script editing, voice customization, and final approval before publishing.",
  },
  {
    question: "What about copyright and content ownership?",
    answer:
      "All AI-generated content created through our platform is yours to own. We use licensed AI tools that grant commercial usage rights. You retain 100% ownership of your videos, channel, and revenue.",
  },
  {
    question: "How long does it take to create a video?",
    answer:
      "With our templates and automation, most videos can be created in under 40 minutes: 5 mins for script generation, 10 mins for AI video creation, 3 mins for voice-over, 15 mins for editing, and 5 mins for upload. After training, many creators reduce this to 20-30 minutes per video.",
  },
  {
    question: "Do I need technical skills or video editing experience?",
    answer:
      "No! Our platform is designed for beginners. We provide step-by-step tutorials, pre-made templates, and AI automation that handles the complex parts. If you can use YouTube and fill out forms, you can use our system.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "Basic tier includes email support. Premium tier adds chat support with faster response times. Enterprise tier includes priority 24/7 support with dedicated account management and monthly strategy calls.",
  },
  {
    question: "Can I really make money with affiliate marketing?",
    answer:
      "Yes, but success depends on your niche, content quality, and consistency. Our auto-affiliate engine connects you with 20+ high-paying programs (SmartSuite at 50%, Shopify at 200%, etc.). Many creators earn $500-$5,000/month in commissions after building an audience.",
  },
  {
    question: "What's the difference between the pricing tiers?",
    answer:
      "Basic ($500) gives you the landing page and tools overview. Premium ($1,200) unlocks the affiliate engine with 50 programs and the ROI calculator. Enterprise ($3,500) adds the admin dashboard, unlimited programs, API integrations, and auto-updates.",
  },
  {
    question: "Is there a refund policy?",
    answer:
      "Yes! We offer a 30-day money-back guarantee. If you're not satisfied with the platform, contact us within 30 days of purchase for a full refund, no questions asked.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 md:py-32">
      <Container>
        <SectionHeading
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about the AI Video Factory"
        />

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card glass className="overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full text-left p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-lg pr-8">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
