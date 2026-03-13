import React from 'react';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { GlassCard } from '../ui/GlassCard';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

export const Affiliates = () => {
  const programs = [
    { name: "CoinLedger", commission: "25% recurring", category: "Crypto Tax" },
    { name: "Jasper AI", commission: "30% recurring", category: "AI Tools" },
    { name: "beehiiv", commission: "50% 12-months", category: "Newsletter" },
    { name: "NordVPN", commission: "40-100% CPA", category: "Security" },
    { name: "Pictory", commission: "20-50% recurring", category: "Video AI" },
    { name: "Teachable", commission: "30-50% recurring", category: "Education" },
    { name: "Webflow", commission: "50% 12-months", category: "Web Design" },
    { name: "GetResponse", commission: "33% recurring", category: "Marketing" },
    { name: "Koinly", commission: "20-40% rev share", category: "Crypto Tax" },
    { name: "CoinPanda", commission: "20-40% lifetime", category: "Crypto" },
  ];

  return (
    <section className="py-20 bg-surface/30">
      <Container>
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-5xl font-bold font-heading mb-4"
          >
            Top <GradientText>Affiliate Programs</GradientText>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-400 max-w-2xl mx-auto"
          >
            Các chương trình tiếp thị liên kết High-Ticket và Recurring Commission phù hợp nhất cho kênh của bạn.
          </motion.p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {programs.map((prog, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <GlassCard className="p-4 hover:border-primary/40 transition-all group cursor-default h-full">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-gray-500 uppercase">{prog.category}</span>
                  <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-bold text-white text-lg mb-1">{prog.name}</h3>
                <p className="text-sm text-secondary font-medium">{prog.commission}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
};
