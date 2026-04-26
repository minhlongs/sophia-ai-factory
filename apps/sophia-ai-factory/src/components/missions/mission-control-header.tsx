'use client';

/**
 * MissionControlHeader — NL mission input + Quick Actions toolbar
 * Calls POST /api/raas/missions with mode:"nl"
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface MissionControlHeaderProps {
  onMissionCreated?: (missionId: string) => void;
}

export function MissionControlHeader({ onMissionCreated }: MissionControlHeaderProps) {
  const t = useTranslations('dashboard.missions.control');
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/raas/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, mode: 'nl' }),
      });
      if (res.ok) {
        const data = await res.json() as { mission?: { id?: string }; mission_id?: string };
        const id = data.mission_id ?? data.mission?.id;
        setPrompt('');
        if (id) onMissionCreated?.(id);
      }
    } catch {
      // Silently handle — user can retry
    } finally {
      setSubmitting(false);
    }
  }, [prompt, submitting, onMissionCreated]);

  const handlePauseAll = useCallback(async () => {
    await fetch('/api/agents/pause', { method: 'POST' });
  }, []);

  const handleNewMission = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">satellite_alt</span>
          {t('title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          ref={textareaRef}
          placeholder={t('prompt_placeholder')}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          maxLength={2000}
          className="resize-none"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              void handleSubmit();
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => { void handleSubmit(); }}
            disabled={!prompt.trim() || submitting}
            size="sm"
          >
            <span className="material-symbols-outlined text-base mr-1">rocket_launch</span>
            {submitting ? t('submitting') : t('submit')}
          </Button>

          {/* Quick Actions */}
          <Button variant="outline" size="sm" onClick={handleNewMission}>
            <span className="material-symbols-outlined text-base mr-1">add</span>
            {t('new_mission')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { void handlePauseAll(); }}
          >
            <span className="material-symbols-outlined text-base mr-1">pause</span>
            {t('pause_all')}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/system-health')}
          >
            <span className="material-symbols-outlined text-base mr-1">analytics</span>
            {t('view_logs')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
