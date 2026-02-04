import React from 'react';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { GlassCard } from '../ui/GlassCard';
import { Bot, Cpu, Database, Cloud, Mic, Video, Zap, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export const TechStack = () => {
  const tools = [
    { name: "OpenClaw", role: "Orchestrator", icon: <Cpu className="w-8 h-8 text-blue-500" /> },
    { name: "n8n", role: "Automation", icon: <WorkflowIcon className="w-8 h-8 text-red-500" /> },
    { name: "OpenRouter", role: "300+ AI Models", icon: <Bot className="w-8 h-8 text-green-500" /> },
    { name: "ElevenLabs", role: "Voice Cloning", icon: <Mic className="w-8 h-8 text-white" /> },
    { name: "D-ID", role: "AI Avatar", icon: <Video className="w-8 h-8 text-purple-500" /> },
    { name: "Pictory", role: "B-Roll Gen", icon: <Layers className="w-8 h-8 text-indigo-500" /> },
    { name: "Airtable", role: "Database", icon: <Database className="w-8 h-8 text-yellow-500" /> },
    { name: "Cloudinary", role: "Storage", icon: <Cloud className="w-8 h-8 text-blue-400" /> },
  ];

  return (
    <section className="py-20 bg-black/20">
      <Container>
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-2xl md:text-4xl font-bold font-heading mb-4"
          >
            Tech Stack <GradientText>Mạnh Mẽ</GradientText>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-400"
          >
            Tích hợp những công nghệ AI hàng đầu thế giới vào một hệ thống duy nhất
          </motion.p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <GlassCard className="p-6 flex flex-col items-center justify-center text-center h-full">
                <div className="mb-4 p-3 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  {tool.icon}
                </div>
                <h3 className="font-bold text-lg mb-1">{tool.name}</h3>
                <p className="text-xs text-gray-500">{tool.role}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
};

// Custom icon for n8n since it's not in lucide
const WorkflowIcon = ({ className }: { className?: string }) => (
  <Zap className={className} />
);
