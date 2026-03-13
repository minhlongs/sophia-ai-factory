import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { GlassCard } from '../ui/GlassCard';
import { TypewriterLoop } from '../ui/TypewriterEffect';
import { FloatingElement } from '../ui/FloatingElement';
import { ArrowRight, Zap, TrendingUp, Clock, Bot, Cpu, Workflow } from 'lucide-react';

export const Hero = () => {
  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20">
       {/* Animated Background Orbs */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
              x: [0, 50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3],
              x: [0, -30, 0],
              y: [0, 50, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px]"
          />
           <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-[40%] left-[20%] w-[300px] h-[300px] bg-accent/20 rounded-full blur-[100px]"
          />
       </div>

      <Container className="relative z-10">
        {/* Floating Elements - 3D Tech Stack */}
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <FloatingElement depth={2} className="top-[20%] left-[5%]">
                <div className="p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
                    <Bot className="w-10 h-10 text-cyan-400" />
                </div>
            </FloatingElement>
            <FloatingElement depth={1} duration={8} className="top-[60%] left-[2%]">
                <div className="p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
                    <Cpu className="w-12 h-12 text-purple-400" />
                </div>
            </FloatingElement>
            <FloatingElement depth={3} className="top-[15%] right-[10%]">
                 <div className="p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
                    <Workflow className="w-10 h-10 text-pink-400" />
                </div>
            </FloatingElement>
             <FloatingElement depth={2} duration={7} className="bottom-[25%] right-[5%]">
                 <div className="p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
                    <Zap className="w-12 h-12 text-yellow-400" />
                </div>
            </FloatingElement>
        </div>

        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block px-4 py-1.5 mb-8 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              ✨ Giải pháp tự động hóa nội dung 2025
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold font-heading mb-8 leading-tight tracking-tight drop-shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Nền Tảng <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">
                <TypewriterLoop words={["Video AI", "Affiliate", "Automation", "Passive Income"]} />
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-2xl text-gray-300 mb-12 max-w-3xl leading-relaxed drop-shadow-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Tự động sản xuất video, phân phối đa kênh, thu nhập thụ động.
            Xây dựng đế chế nội dung của bạn với chi phí tối thiểu.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-6 mb-20"
          >
            <Button size="lg" onClick={scrollToPricing} className="group text-lg px-8 py-6 shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:shadow-[0_0_30px_rgba(0,245,255,0.6)] transition-all bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-105 border-0">
              Xem Báo Giá <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })} className="text-lg px-8 py-6 border-white/20 hover:bg-white/5 backdrop-blur-md">
              Tìm Hiểu Quy Trình
            </Button>
          </motion.div>

          {/* Stats Cards - Glassmorphism */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full relative z-20">
            {[
                { icon: TrendingUp, title: "$80/tháng", subtitle: "Chi phí cực thấp", color: "text-blue-400" },
                { icon: Zap, title: "95% Tiết Kiệm", subtitle: "Tối ưu chi phí API", color: "text-yellow-400", highlight: true },
                { icon: Clock, title: "<15 Phút", subtitle: "Tự động hóa 100%", color: "text-purple-400" }
            ].map((stat, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + (index * 0.1) }}
                    whileHover={{ y: -5 }}
                >
                  <GlassCard
                    className={`p-6 flex flex-col items-center text-center h-full ${stat.highlight ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : ''}`}
                    hoverEffect={true}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 ${stat.color} shadow-lg ring-1 ring-white/10`}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2 font-heading">{stat.title}</h3>
                    <p className="text-gray-400 text-sm">{stat.subtitle}</p>
                  </GlassCard>
                </motion.div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
};
