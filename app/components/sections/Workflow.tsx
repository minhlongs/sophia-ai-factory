import React from 'react';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { GlassCard } from '../ui/GlassCard';
import { MessageSquare, Server, Workflow as WorkflowIcon, Bot, Share2, ArrowRight } from 'lucide-react';
import { FadeIn } from '../animations/FadeIn';
import { StaggerContainer, staggerItem } from '../animations/StaggerContainer';
import { motion } from 'framer-motion';

export const Workflow = () => {
  const steps = [
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-400" />,
      title: "Telegram Command",
      description: "Gửi lệnh tạo video trực tiếp từ Telegram",
      tools: ["Telegram Bot"]
    },
    {
      icon: <Server className="w-6 h-6 text-indigo-400" />,
      title: "OpenClaw Gateway",
      description: "Xử lý yêu cầu và điều phối tác vụ",
      tools: ["OpenClaw"]
    },
    {
      icon: <WorkflowIcon className="w-6 h-6 text-purple-400" />,
      title: "n8n Automation",
      description: "Chạy luồng xử lý tự động phức tạp",
      tools: ["n8n Workflow"]
    },
    {
      icon: <Bot className="w-6 h-6 text-pink-400" />,
      title: "AI Generation",
      description: "Tạo nội dung, giọng nói và hình ảnh",
      tools: ["OpenRouter", "ElevenLabs", "D-ID", "Pictory"]
    },
    {
      icon: <Share2 className="w-6 h-6 text-rose-400" />,
      title: "Multi-Platform",
      description: "Tự động đăng tải lên các nền tảng",
      tools: ["YouTube", "TikTok", "Instagram"]
    }
  ];

  return (
    <section id="workflow" className="py-20 relative bg-surface/50">
      <Container>
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            Quy Trình <GradientText>Tự Động Hóa</GradientText>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Hệ thống hoạt động khép kín, biến ý tưởng thành video hoàn chỉnh chỉ với một lệnh chat đơn giản.
          </p>
        </FadeIn>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <FadeIn delay={0.2} className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 -translate-y-1/2 z-0" />

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10" staggerChildren={0.15}>
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={staggerItem}
              >
                <GlassCard className="h-full flex flex-col items-center text-center p-6 bg-background/80 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 shadow-lg ring-1 ring-white/10">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-xs text-gray-500 mb-3 h-8">{step.description}</p>

                  <div className="mt-auto flex flex-wrap justify-center gap-1">
                    {step.tools.map((tool, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-300 border border-white/5">
                        {tool}
                      </span>
                    ))}
                  </div>

                  {index < steps.length - 1 && (
                    <div className="md:hidden absolute bottom-[-1.5rem] left-1/2 -translate-x-1/2 text-gray-600">
                      <ArrowRight className="w-6 h-6 rotate-90" />
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </StaggerContainer>
        </div>
      </Container>
    </section>
  );
};
