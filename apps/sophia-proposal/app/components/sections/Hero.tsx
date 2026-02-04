import React from 'react';
import { motion } from 'framer-motion';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ArrowRight, Zap, TrendingUp, Clock } from 'lucide-react';

export const Hero = () => {
  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[100px]" />
      </div>

      <Container>
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
              ✨ Giải pháp tự động hóa nội dung 2025
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold font-heading mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Nền Tảng <GradientText>Video AI</GradientText> <br className="hidden md:block" />
            + Affiliate Marketing
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl"
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
            className="flex flex-col sm:flex-row gap-4 mb-16"
          >
            <Button size="lg" onClick={scrollToPricing} className="group">
              Xem Báo Giá <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>
              Tìm Hiểu Quy Trình
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="p-6 flex flex-col items-center text-center h-full">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">$80/tháng → 30 Videos</h3>
                <p className="text-gray-400 text-sm">Chi phí cực thấp cho sản lượng nội dung cao</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card className="p-6 flex flex-col items-center text-center h-full border-primary/50 bg-primary/5">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">95% Tiết Kiệm</h3>
                <p className="text-gray-400 text-sm">Tối ưu chi phí nhờ tích hợp OpenRouter & AI APIs</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Card className="p-6 flex flex-col items-center text-center h-full">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">&lt;15 Phút/Video</h3>
                <p className="text-gray-400 text-sm">Quy trình tự động hóa hoàn toàn từ ý tưởng đến publish</p>
              </Card>
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
};
