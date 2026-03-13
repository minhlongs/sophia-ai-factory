import React from 'react';
import { Container } from '../ui/Container';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { GradientText } from '../ui/GradientText';
import { Check, Star } from 'lucide-react';
import { formatCurrency } from '@/app/lib/utils';
import { motion } from 'framer-motion';
import { FadeIn } from '../animations/FadeIn';
import { StaggerContainer, staggerItem } from '../animations/StaggerContainer';

export const Pricing = () => {
  const tiers = [
    {
      name: "Minimal",
      priceVND: 35000000,
      monthlyCost: 80,
      description: "Khởi đầu vững chắc cho kênh Affiliate mới",
      features: [
        "1 YouTube channel setup",
        "4 script templates",
        "Basic n8n workflows",
        "Telegram command training",
        "30 days support"
      ],
      highlight: false
    },
    {
      name: "Standard",
      priceVND: 55000000,
      monthlyCost: 120,
      description: "Tối ưu hóa cho tăng trưởng và đa kênh",
      features: [
        "3 YouTube channels",
        "8 script templates (all formats)",
        "Full n8n workflow suite",
        "Voice clone setup (ElevenLabs)",
        "Affiliate tracking dashboard",
        "90 days support"
      ],
      highlight: true
    },
    {
      name: "Scale",
      priceVND: 85000000,
      monthlyCost: 200,
      description: "Giải pháp toàn diện cho đế chế nội dung",
      features: [
        "5 YouTube channels",
        "Unlimited templates",
        "All platform publishing",
        "Custom OpenClaw skills",
        "Dedicated Telegram bot",
        "Priority support 12 tháng",
        "Monthly strategy calls"
      ],
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="py-20 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl opacity-20 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-primary/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-secondary/30 rounded-full blur-[120px]" />
      </div>

      <Container>
        <FadeIn className="text-center mb-16 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            Bảng Giá <GradientText>Dịch Vụ</GradientText>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Chi phí đầu tư một lần, sở hữu hệ thống vĩnh viễn. Chỉ trả tiền API hàng tháng khi sử dụng.
          </p>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10" staggerChildren={0.1}>
          {tiers.map((tier, index) => (
            <motion.div
              key={index}
              variants={staggerItem}
              className={`relative ${tier.highlight ? 'md:-mt-8 md:mb-8' : ''}`}
            >
              {tier.highlight && (
                <>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg shadow-primary/20 z-20 whitespace-nowrap">
                    <Star className="w-3 h-3 fill-current" /> RECOMMENDED
                  </div>
                  {/* Holographic Border Effect */}
                  <div className="absolute -inset-[2px] rounded-[18px] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-75 blur-sm animate-pulse" />
                </>
              )}

              <GlassCard className={`h-full flex flex-col p-8 ${tier.highlight ? 'bg-primary/[0.03] relative overflow-hidden shadow-neon-cyan/20 border-0' : 'bg-surface/50'}`}>
                {tier.highlight && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
                )}

                <div className="mb-8">
                  <h3 className="text-xl font-bold font-heading mb-2">{tier.name}</h3>
                  <p className="text-gray-400 text-sm h-10">{tier.description}</p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{formatCurrency(tier.priceVND)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    + ${tier.monthlyCost}/tháng (AI usage estimated)
                  </div>
                </div>

                <div className="space-y-4 mb-8 flex-grow">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className={`mt-0.5 rounded-full p-0.5 ${tier.highlight ? 'bg-primary/20 text-primary' : 'bg-gray-800 text-gray-400'}`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={tier.highlight ? 'primary' : 'outline'}
                  className="w-full"
                  onClick={() => document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Liên Hệ Tư Vấn
                </Button>
              </GlassCard>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
};
