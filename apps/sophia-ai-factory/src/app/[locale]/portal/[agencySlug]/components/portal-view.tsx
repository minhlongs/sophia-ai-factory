'use client';

/**
 * 100% White-Label Client Portal Composed View
 *
 * Layer: land (Client Component)
 * Zero vendor leakage — all branding, typography, and accents use agency theme tokens.
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-view
 */

import React, { useState } from 'react';
import type {
  PortalClientProps,
  PortalTab,
  VideoAspectRatio,
  VideoDeliverable,
} from './portal-types';
import { PortalHeader } from './portal-header';
import { PortalMetricsBanner } from './portal-metrics-banner';
import { PortalOverviewTab } from './portal-overview-tab';
import {
  PortalCampaignsTab,
  PortalStudioTab,
  PortalSupportTab,
} from './portal-secondary-tabs';
import { PortalFooter } from './portal-footer';

export function PortalView({ agency, isVi }: PortalClientProps) {
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [selectedRatio, setSelectedRatio] = useState<VideoAspectRatio>('9:16');
  const [selectedLang, setSelectedLang] = useState<string>(isVi ? 'VI' : 'EN');
  const [promptInput, setPromptInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [deliverables, setDeliverables] = useState<VideoDeliverable[]>([
    {
      id: 'vid-101',
      title: isVi ? 'Chiến dịch Ra mắt Sản phẩm Mùa Thu' : 'Autumn Product Launch Campaign',
      platform: 'TikTok',
      duration: '0:35',
      aspectRatio: '9:16',
      status: 'ready',
      createdAt: isVi ? 'Hôm nay, 09:30' : 'Today, 09:30 AM',
      thumbnailColor: '#1e293b',
    },
    {
      id: 'vid-102',
      title: isVi ? 'Video Đánh giá Khách hàng & Feedback' : 'Customer Review & Testimonial Reel',
      platform: 'Reels',
      duration: '0:45',
      aspectRatio: '9:16',
      status: 'ready',
      createdAt: isVi ? 'Hôm qua' : 'Yesterday',
      thumbnailColor: '#0f172a',
    },
    {
      id: 'vid-103',
      title: isVi ? 'Video Giới thiệu Tính năng Công nghệ' : 'Tech Feature Explainer Shorts',
      platform: 'YouTube Shorts',
      duration: '0:58',
      aspectRatio: '16:9',
      status: 'rendering',
      createdAt: isVi ? '2 ngày trước' : '2 days ago',
      thumbnailColor: '#334155',
    },
  ]);

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newVid: VideoDeliverable = {
        id: `vid-${Date.now().toString().slice(-4)}`,
        title: promptInput.trim(),
        platform: selectedRatio === '9:16' ? 'TikTok' : selectedRatio === '16:9' ? 'YouTube Shorts' : 'Reels',
        duration: '0:30',
        aspectRatio: selectedRatio,
        status: 'rendering',
        createdAt: isVi ? 'Vừa xong' : 'Just now',
        thumbnailColor: '#1e293b',
      };
      setDeliverables([newVid, ...deliverables]);
      setPromptInput('');
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      <PortalHeader
        agency={agency}
        isVi={isVi}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <PortalMetricsBanner
          agency={agency}
          isVi={isVi}
          deliverablesCount={deliverables.length}
        />

        {activeTab === 'overview' && (
          <PortalOverviewTab
            isVi={isVi}
            deliverables={deliverables}
            promptInput={promptInput}
            setPromptInput={setPromptInput}
            selectedRatio={selectedRatio}
            setSelectedRatio={setSelectedRatio}
            selectedLang={selectedLang}
            setSelectedLang={setSelectedLang}
            isSubmitting={isSubmitting}
            submitSuccess={submitSuccess}
            onSubmit={handleCreateVideo}
          />
        )}

        {activeTab === 'campaigns' && (
          <PortalCampaignsTab
            agency={agency}
            isVi={isVi}
            deliverables={deliverables}
          />
        )}

        {activeTab === 'studio' && (
          <PortalStudioTab isVi={isVi} />
        )}

        {activeTab === 'support' && (
          <PortalSupportTab
            agency={agency}
            isVi={isVi}
          />
        )}
      </main>

      <PortalFooter agency={agency} isVi={isVi} />
    </div>
  );
}
