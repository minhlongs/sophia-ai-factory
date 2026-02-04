import React, { useState } from 'react';
import { Container } from '../ui/Container';
import { GradientText } from '../ui/GradientText';
import { GlassCard } from '../ui/GlassCard';
import { formatNumber } from '@/app/lib/utils';
import { motion } from 'framer-motion';
import { FadeIn } from '../animations/FadeIn';

export const ROICalculator = () => {
  // Inputs
  const [videosPerMonth, setVideosPerMonth] = useState(30);
  const [avgViews, setAvgViews] = useState(2000);
  const [ctr, setCtr] = useState(2);
  const [conversionRate, setConversionRate] = useState(1);
  const [avgCommission, setAvgCommission] = useState(20);

  // Outputs - Calculated directly (Derived State)
  const monthlyViews = videosPerMonth * avgViews;
  const monthlyClicks = monthlyViews * (ctr / 100);
  const monthlySales = monthlyClicks * (conversionRate / 100);
  const monthlyRevenue = monthlySales * avgCommission;

  // Calculate Costs (Approximate)
  // AI Cost ~ $2.5/video + Platform Subscriptions
  const aiCost = videosPerMonth * 2.5;
  const platformCost = 30; // Basic tools subscription estimate
  const totalMonthlyCost = aiCost + platformCost;

  // Setup Cost Amortized over 12 months for ROI calc (using Standard tier 55M VND ~ $2200)
  const setupCostUSD = 2200;

  // ROI Calculation (Annualized)
  const annualRevenue = monthlyRevenue * 12;
  const annualCost = (totalMonthlyCost * 12) + setupCostUSD;
  const annualProfit = annualRevenue - annualCost;

  const roi = annualCost > 0 ? (annualProfit / annualCost) * 100 : 0;

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10" />

      <Container>
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            Tính Toán <GradientText>Lợi Nhuận (ROI)</GradientText>
          </h2>
          <p className="text-gray-400">
            Ước tính tiềm năng thu nhập từ hệ thống Video Affiliate Automation
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Inputs */}
          <FadeIn delay={0.2} direction="right">
          <GlassCard className="p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm">1</span>
              Thông số đầu vào
            </h3>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">Videos xuất bản / tháng</label>
                  <span className="font-bold text-primary">{videosPerMonth}</span>
                </div>
                <input
                  type="range" min="10" max="300" step="10"
                  value={videosPerMonth} onChange={(e) => setVideosPerMonth(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">View trung bình / video</label>
                  <span className="font-bold text-primary">{formatNumber(avgViews)}</span>
                </div>
                <input
                  type="range" min="100" max="50000" step="100"
                  value={avgViews} onChange={(e) => setAvgViews(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">CTR (Click-through Rate)</label>
                  <span className="font-bold text-primary">{ctr}%</span>
                </div>
                <input
                  type="range" min="0.1" max="10" step="0.1"
                  value={ctr} onChange={(e) => setCtr(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">Conversion Rate</label>
                  <span className="font-bold text-primary">{conversionRate}%</span>
                </div>
                <input
                  type="range" min="0.1" max="10" step="0.1"
                  value={conversionRate} onChange={(e) => setConversionRate(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">Hoa hồng trung bình / Sale</label>
                  <span className="font-bold text-primary">${avgCommission}</span>
                </div>
                <input
                  type="range" min="1" max="200" step="1"
                  value={avgCommission} onChange={(e) => setAvgCommission(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </GlassCard>
          </FadeIn>

          {/* Results */}
          <FadeIn delay={0.4} direction="left" className="flex flex-col gap-6">
             <GlassCard className="p-8 flex-1 flex flex-col justify-center bg-gradient-to-br from-surface to-primary/5 border-primary/20 shadow-neon-cyan/10">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary text-sm">2</span>
                  Dự báo doanh thu
                </h3>

                <div className="space-y-8">
                  <div className="relative overflow-hidden rounded-2xl bg-black/40 p-6 border border-white/5">
                    <p className="text-gray-400 text-sm mb-1">Doanh thu tháng</p>
                    <motion.div
                      key={monthlyRevenue}
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-4xl md:text-5xl font-bold text-white tracking-tight"
                    >
                      ${formatNumber(Math.round(monthlyRevenue))}
                    </motion.div>
                    <div className="absolute right-0 top-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  </div>

                  <div className="relative overflow-hidden rounded-2xl bg-black/40 p-6 border border-white/5">
                     <p className="text-gray-400 text-sm mb-1">Doanh thu năm</p>
                    <motion.div
                      key={annualRevenue}
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight"
                    >
                      ${formatNumber(Math.round(annualRevenue))}
                    </motion.div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400 font-medium">ROI (Năm đầu)</span>
                    <span className="text-2xl font-bold text-green-400">
                      {roi > 0 ? `+${formatNumber(Math.round(roi))}%` : `${formatNumber(Math.round(roi))}%`}
                    </span>
                  </div>
                </div>
             </GlassCard>
          </FadeIn>
        </div>
      </Container>
    </section>
  );
};
