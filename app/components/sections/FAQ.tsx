import React, { useState } from 'react';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { GlassCard } from '../ui/GlassCard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '../animations/FadeIn';

export const FAQ = () => {
  const faqs = [
    {
      question: "Sophia cần biết code không?",
      answer: "Không. Hệ thống được thiết kế để bạn chỉ cần gửi command qua Telegram. Mọi thứ còn lại (tạo script, voice, video, edit, upload) đều tự động 100%."
    },
    {
      question: "Mất bao lâu để setup hoàn chỉnh?",
      answer: "Thời gian setup trung bình từ 2-4 tuần tùy vào gói dịch vụ (Tier) bạn chọn. Quy trình bao gồm: Setup kênh, training AI, cấu hình n8n workflow và test hệ thống."
    },
    {
      question: "Monthly cost bao gồm những gì?",
      answer: "Phí duy trì hàng tháng chủ yếu là chi phí API trả cho các bên thứ ba (OpenRouter, ElevenLabs, D-ID...) để tạo nội dung. Bạn chỉ trả theo dung lượng sử dụng thực tế, giúp tiết kiệm tối đa so với thuê nhân sự."
    },
    {
      question: "Có thể scale lên bao nhiêu video?",
      answer: "Không giới hạn. Hệ thống automation có thể xử lý hàng trăm video mỗi ngày. Rào cản duy nhất là budget API của bạn và giới hạn upload của các nền tảng (YouTube/TikTok)."
    }
  ];

  return (
    <section className="py-20">
      <Container>
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            Câu Hỏi <GradientText>Thường Gặp</GradientText>
          </h2>
        </FadeIn>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <FadeIn key={index} delay={index * 0.1}>
              <FAQItem question={faq.question} answer={faq.answer} />
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
};

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <GlassCard className="overflow-hidden border-white/5 bg-white/[0.02]" hoverEffect={false}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 text-left flex justify-between items-center focus:outline-none"
      >
        <span className="font-bold text-lg">{question}</span>
        {isOpen ? <ChevronUp className="text-primary" /> : <ChevronDown className="text-gray-500" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 text-gray-400 border-t border-white/5 pt-4">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
