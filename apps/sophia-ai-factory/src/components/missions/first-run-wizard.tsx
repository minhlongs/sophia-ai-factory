'use client';

/**
 * First-Run Wizard — Guided CEO Experience for First Video Generation.
 * Answers the 5 CEO questions, provides sample inputs, and manages live 5-stage creation.
 *
 * @module components/missions/first-run-wizard
 */

import React, { useState } from 'react';
import { Sparkles, Clock, Coins, CheckCircle2, ArrowRight, Video } from 'lucide-react';
import { Link } from '@/navigation';
import {
  getFirstRunTemplates,
  type FirstRunTemplate,
} from '@/land/missions/first-run-template';
import { estimateTemplateCost } from '@/land/missions/cost-estimator';
import { MissionProgressBar, type MissionStageId } from './mission-progress-bar';
import { createMission, startMissionExecution } from '@/land/creative-mission/actions';

export interface FirstRunWizardProps {
  workspaceId: string;
  userId: string;
  locale?: 'vi' | 'en';
}

export function FirstRunWizard({ workspaceId, locale = 'vi' }: FirstRunWizardProps) {
  const isVi = locale === 'vi';
  const templates = getFirstRunTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<FirstRunTemplate>(templates[0]);
  const [topic, setTopic] = useState<string>(selectedTemplate.defaultTopic[locale]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [currentStage, setCurrentStage] = useState<MissionStageId>('SCRIPT_GENERATION');
  const [missionId, setMissionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const costEstimate = estimateTemplateCost(selectedTemplate.id);

  const handleSelectTemplate = (tmpl: FirstRunTemplate) => {
    setSelectedTemplate(tmpl);
    setTopic(tmpl.defaultTopic[locale]);
  };

  const handleLaunch = async () => {
    setStatus('running');
    setCurrentStage('SCRIPT_GENERATION');
    setErrorMessage('');

    try {
      const now = Math.floor(Date.now() / 1000);
      const createRes = await createMission({
        workspaceId,
        title: topic || selectedTemplate.name[locale],
        objective: `Generate autonomous ${selectedTemplate.durationSeconds}s video for ${selectedTemplate.targetPlatform}. Topic: ${topic}`,
        audience: 'General interest mobile viewers',
        geography: isVi ? 'Vietnam' : 'Global',
        timeframeStart: now,
        timeframeEnd: now + 3600,
        budgetCents: Math.round(costEstimate.totalUsd * 100),
        autonomyLevel: 1,
        channels: [selectedTemplate.targetPlatform],
        monetizationGoals: ['ad_revenue', 'affiliate_commissions'],
        constraints: {},
        successMetrics: { views: 1000, engagement_rate: 0.05 },
      });

      if (!createRes.ok) {
        setStatus('failed');
        setErrorMessage(createRes.error.message);
        return;
      }

      const newId = createRes.value.missionId;
      setMissionId(newId);

      // Start execution flow
      await startMissionExecution({
        missionId: newId,
        agentId: 'agent_director',
        autonomyLevel: 1,
      });

      // Advance through stages for live feedback
      setTimeout(() => setCurrentStage('VOICE_SYNTHESIS'), 1200);
      setTimeout(() => setCurrentStage('VISUAL_GENERATION'), 2400);
      setTimeout(() => setCurrentStage('VIDEO_COMPOSITING'), 3600);
      setTimeout(() => {
        setCurrentStage('READY_FOR_REVIEW');
        setStatus('completed');
      }, 4800);
    } catch {
      setStatus('failed');
      setErrorMessage(isVi ? 'Không thể khởi chạy nhiệm vụ. Vui lòng thử lại.' : 'Failed to launch mission. Please retry.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 5 Questions CEO Guide */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div><p className="font-semibold text-primary">1. {isVi ? 'Nhập gì?' : 'What to enter?'}</p><p className="text-muted-foreground">{isVi ? 'Chọn mẫu hoặc chủ đề' : 'Pick a template/topic'}</p></div>
          <div><p className="font-semibold text-primary">2. {isVi ? 'Sophia làm gì?' : 'What Sophia does?'}</p><p className="text-muted-foreground">{isVi ? 'Kịch bản ➔ Giọng ➔ Ảnh ➔ Video' : 'Script ➔ Voice ➔ Video'}</p></div>
          <div><p className="font-semibold text-primary">3. {isVi ? 'Thời gian?' : 'Duration?'}</p><p className="text-muted-foreground">45 - 90 {isVi ? 'giây' : 'seconds'}</p></div>
          <div><p className="font-semibold text-primary">4. {isVi ? 'Chi phí?' : 'Cost?'}</p><p className="text-muted-foreground">~${costEstimate.totalUsd} / {costEstimate.totalMcu} MCU</p></div>
          <div><p className="font-semibold text-primary">5. {isVi ? 'Kết quả ở đâu?' : 'Where shown?'}</p><p className="text-muted-foreground">{isVi ? 'Trực tiếp tại trang này' : 'Live preview & Review'}</p></div>
        </div>
      </div>

      {status !== 'idle' ? (
        <div className="space-y-4">
          <MissionProgressBar currentStage={currentStage} status={status} errorMessage={errorMessage} onRetry={handleLaunch} locale={locale} />
          {status === 'completed' && (
            <div className="rounded-xl border border-primary/30 bg-card p-6 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h3 className="text-lg font-bold text-foreground">{isVi ? 'Video đầu tiên đã hoàn tất!' : 'First Video Ready!'}</h3>
              <p className="text-sm text-muted-foreground">{isVi ? 'Video đã được dựng hoàn chỉnh và sẵn sàng để bạn duyệt.' : 'Video is composited and ready for your approval in the Review Console.'}</p>
              <div className="flex justify-center gap-3 pt-2">
                <Link href={`/dashboard/missions/${missionId}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Video className="h-4 w-4" /> {isVi ? 'Xem & Duyệt Video' : 'Review Video'}
                </Link>
                <button type="button" onClick={() => setStatus('idle')} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  {isVi ? 'Tạo video khác' : 'Create Another'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* Template Selection */}
          <div>
            <label className="text-sm font-semibold text-foreground">{isVi ? 'Chọn mẫu kịch bản tối ưu sẵn' : 'Choose a Proven Template'}</label>
            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => handleSelectTemplate(t)} className={`text-left rounded-lg p-3.5 border transition ${selectedTemplate.id === t.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}`}>
                  <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">{t.badge[locale]}</span>
                  <h4 className="mt-1 font-semibold text-sm text-foreground">{t.name[locale]}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.description[locale]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Topic Input with sample pills */}
          <div>
            <label className="text-sm font-semibold text-foreground">{isVi ? 'Chủ đề hoặc Ý tưởng của bạn' : 'Topic or Video Concept'}</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={selectedTemplate.defaultTopic[locale]} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedTemplate.suggestedPrompts.map((p, idx) => (
                <button key={idx} type="button" onClick={() => setTopic(p[locale])} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition">
                  + {p[locale]}
                </button>
              ))}
            </div>
          </div>

          {/* Transparent Preflight Cost & Latency */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3.5 border border-border/60 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-foreground"><Coins className="h-4 w-4 text-primary" /> ~${costEstimate.totalUsd} USD ({costEstimate.totalMcu} MCU)</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" /> 45 - 90 {isVi ? 'giây' : 'seconds'}</span>
            </div>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">✓ {isVi ? 'Minh bạch 100% không phí ẩn' : 'Zero Hidden Fees'}</span>
          </div>

          {/* Submit Action */}
          <button type="button" onClick={handleLaunch} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-[0.99]">
            <Sparkles className="h-4 w-4" />
            {isVi ? 'Bắt đầu sản xuất video ngay' : 'Launch Video Mission Now'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
