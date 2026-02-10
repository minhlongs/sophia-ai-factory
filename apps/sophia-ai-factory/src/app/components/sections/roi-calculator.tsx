"use client";

import { Container } from "@/components/ui/container";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";

export function ROICalculator() {
  const t = useTranslations('landing');
  const [channels, setChannels] = useState(3);
  const [videosPerWeek, setVideosPerWeek] = useState(10);
  const [avgViews, setAvgViews] = useState(1000);

  const monthlyRevenue = useMemo(() => {
    const totalVideos = channels * videosPerWeek * 4;
    const totalViews = totalVideos * avgViews;
    const adRevenue = (totalViews / 1000) * 2;
    const affiliateRevenue = (totalViews / 100) * 0.5;
    const total = adRevenue + affiliateRevenue;
    return Math.round(total);
  }, [channels, videosPerWeek, avgViews]);

  return (
    <section className="py-20 md:py-32 relative">
      <Container>
        <SectionHeading
          title={t('roi.title')}
          subtitle={t('roi.subtitle')}
        />

        <Card glass className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">{t('roi.calculator_title')}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Input: Channels */}
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-foreground/80">{t('roi.labels.channels')}</label>
                <span className="text-[var(--neon-cyan)] font-bold">{channels}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={channels}
                onChange={(e) => setChannels(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Input: Videos per Week */}
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-foreground/80">{t('roi.labels.videos_per_week')}</label>
                <span className="text-[var(--neon-cyan)] font-bold">{videosPerWeek}</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={videosPerWeek}
                onChange={(e) => setVideosPerWeek(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>30</span>
              </div>
            </div>

            {/* Input: Average Views */}
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-foreground/80">{t('roi.labels.avg_views')}</label>
                <span className="text-[var(--neon-cyan)] font-bold">
                  {avgViews.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={avgViews}
                onChange={(e) => setAvgViews(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>100</span>
                <span>10,000</span>
              </div>
            </div>

            {/* Output: Monthly Revenue — CSS transition instead of framer-motion key animation */}
            <div className="pt-8 border-t border-border">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">{t('roi.labels.projected_revenue')}</p>
                <div className="text-5xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent transition-transform duration-200">
                  ${monthlyRevenue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  {t('roi.estimate_note')}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground text-sm">{t('roi.labels.total_videos')}</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {channels * videosPerWeek * 4}
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground text-sm">{t('roi.labels.total_views')}</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {(channels * videosPerWeek * 4 * avgViews).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <p className="text-center text-muted-foreground text-sm mt-8 max-w-2xl mx-auto">
          {t('roi.disclaimer')}
        </p>

      {/* Custom slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
        }
      `}</style>
      </Container>
    </section>
  );
}
