import React from 'react';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { FadeIn } from '../animations/FadeIn';

export const Features = () => {
  const features = [
    { name: "Videos/tháng", minimal: "30", standard: "60", scale: "120+" },
    { name: "Cost/video", minimal: "$2.67", standard: "$2.00", scale: "$1.67" },
    { name: "Platforms", minimal: "YouTube", standard: "YT + TikTok", scale: "All 3 Platforms" },
    { name: "Telegram Commands", minimal: true, standard: true, scale: true },
    { name: "OpenClaw Gateway", minimal: true, standard: true, scale: true },
    { name: "n8n Workflows", minimal: "2", standard: "4", scale: "6" },
    { name: "Voice Clone", minimal: false, standard: true, scale: true },
    { name: "Custom Templates", minimal: "4", standard: "8", scale: "Unlimited" },
    { name: "Support", minimal: "30 ngày", standard: "90 ngày", scale: "12 tháng" },
  ];

  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-gray-700 mx-auto" />
      );
    }
    return <span className="font-medium">{value}</span>;
  };

  return (
    <section id="features" className="py-20" data-testid="features-section">
      <Container>
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            So Sánh <GradientText>Tính Năng</GradientText>
          </h2>
          <p className="text-gray-400">Chọn gói phù hợp với mục tiêu tăng trưởng của bạn</p>
        </FadeIn>

        <FadeIn delay={0.2} className="overflow-x-auto">
          <div className="min-w-[700px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-4 text-left text-lg text-gray-400 font-normal w-1/4">Tính năng</th>
                  <th className="p-4 text-center text-xl font-bold font-heading w-1/4">Minimal</th>
                  <th className="p-4 text-center text-xl font-bold font-heading text-primary w-1/4 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/50" />
                    Standard
                  </th>
                  <th className="p-4 text-center text-xl font-bold font-heading text-secondary w-1/4">Scale</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${index % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                  >
                    <td className="p-4 text-gray-300">{feature.name}</td>
                    <td className="p-4 text-center text-gray-300">{renderValue(feature.minimal)}</td>
                    <td className="p-4 text-center text-white bg-primary/5 border-x border-primary/10 font-medium">
                      {renderValue(feature.standard)}
                    </td>
                    <td className="p-4 text-center text-white font-medium">{renderValue(feature.scale)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
};
